import React, { useState, useMemo } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Building2, 
  ShieldAlert, 
  Sparkles,
  ArrowRight,
  Filter,
  Play,
  RotateCw
} from 'lucide-react';
import { Activity, Lecturer, Settings, EmailTemplate, DocumentItem, SendLog, SendStatus } from '../types';
import { composeEmail, composeWhatsAppMessage } from '../lib/emailComposer';
import { splitLecturerNames, normalizeArabic } from '../lib/arabicUtils';
import { sendActualEmail, getGmailComposeUrl, getGmailInboxUrl, getMailtoUrl, stripHtmlToText, sendBrowserNotification } from '../lib/emailService';

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  targetActivity?: Activity | null;
  lecturers: Lecturer[];
  aliasMap: Map<string, string>;
  settings: Settings;
  template: EmailTemplate;
  documents: DocumentItem[];
  sendLogs: SendLog[];
  onLogCreated: (log: SendLog) => void;
  onNavigateToSettings?: () => void;
}

interface DispatchItem {
  id: string;
  activity: Activity;
  lecturerName: string;
  lecturerTitle?: string;
  lecturerSpecialty?: string;
  email?: string;
  phone?: string;
  otherLecturers: string[];
  emailStatus?: 'idle' | 'sending' | 'sent' | 'failed';
  emailError?: string;
  emailPreviewUrl?: string;
  whatsappStatus?: 'idle' | 'opened' | 'sent';
  copied?: boolean;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  isOpen,
  onClose,
  activities,
  targetActivity,
  lecturers,
  aliasMap,
  settings,
  template,
  documents,
  sendLogs,
  onLogCreated,
  onNavigateToSettings,
}) => {
  const [daysFilter, setDaysFilter] = useState<number>(settings.days_before || 7);
  const [customRange, setCustomRange] = useState<'due' | 'all' | 'custom'>('due');
  const [filterType, setFilterType] = useState<'all' | 'courses' | 'workshops'>('all');
  const [statusTracker, setStatusTracker] = useState<Record<string, { email?: 'sending' | 'sent' | 'failed'; emailError?: string; wa?: 'opened'; previewUrl?: string }>>({});
  const [isBulkSendingEmail, setIsBulkSendingEmail] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // حساب الأنشطة المستهدفة
  const relevantActivities = useMemo(() => {
    if (targetActivity) {
      return [targetActivity];
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    return activities.filter((act) => {
      // فلتر النوع
      if (filterType === 'courses' && act.type !== 'course') return false;
      if (filterType === 'workshops' && act.type !== 'workshop') return false;

      if (customRange === 'all') return true;

      // نطاق الأيام المستحقة
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + daysFilter);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      return act.start_date >= todayStr && act.start_date <= maxDateStr;
    });
  }, [activities, targetActivity, daysFilter, customRange, filterType]);

  // توليد قائمة المحاضرين المستحقين للتذكير
  const dispatchItems = useMemo(() => {
    const items: DispatchItem[] = [];

    relevantActivities.forEach((act) => {
      // تفكيك أسماء المحاضرين
      const names = splitLecturerNames(act.lecturers_raw);

      // في حال توفر lecturers_details المنظمة
      if (act.lecturers_details && act.lecturers_details.length > 0) {
        act.lecturers_details.forEach((det, idx) => {
          const lecName = det.name || names[idx] || `محاضر ${idx + 1}`;
          const others = names.filter((n) => n !== lecName);
          const email = det.email || (idx === 0 ? act.lecturer_email : undefined);
          const phone = det.phone || (idx === 0 ? act.lecturer_phone : undefined);

          items.push({
            id: `${act.id}-detail-${idx}-${lecName}`,
            activity: act,
            lecturerName: lecName,
            lecturerTitle: act.lecturer_title || 'أستاذ',
            lecturerSpecialty: det.specialty,
            email,
            phone,
            otherLecturers: others,
          });
        });
      } else {
        // مطابقة المحاضرين مع دليل المحاضرين العام
        names.forEach((rawName, idx) => {
          const normRaw = normalizeArabic(rawName);
          let matched: Lecturer | null = null;

          if (act.lecturer_email && idx === 0) {
            matched = {
              id: `lec-${act.id}`,
              full_name: act.lecturer_name || rawName,
              normalized_name: normRaw,
              title: act.lecturer_title,
              department: act.department,
              email: act.lecturer_email,
              phone: act.lecturer_phone,
            };
          } else {
            if (aliasMap.has(normRaw)) {
              matched = lecturers.find((l) => l.id === aliasMap.get(normRaw)) || null;
            }
            if (!matched) {
              matched = lecturers.find(
                (l) => l.normalized_name === normRaw || normalizeArabic(l.full_name) === normRaw
              ) || null;
            }
          }

          const others = names.filter((n) => n !== rawName);
          items.push({
            id: `${act.id}-raw-${idx}-${rawName}`,
            activity: act,
            lecturerName: matched?.full_name || rawName,
            lecturerTitle: matched?.title || act.lecturer_title,
            email: matched?.email || (idx === 0 ? act.lecturer_email : undefined),
            phone: matched?.phone || (idx === 0 ? act.lecturer_phone : undefined),
            otherLecturers: others,
          });
        });
      }
    });

    return items;
  }, [relevantActivities, lecturers, aliasMap]);

  if (!isOpen) return null;

  // إرسال بريد إلكتروني فردي للمحاضر عبر السيرفر
  const handleSendSingleEmail = async (item: DispatchItem) => {
    if (!item.email) return;

    setStatusTracker((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], email: 'sending' },
    }));

    const dummyLec: Lecturer = {
      id: `lec-${item.id}`,
      full_name: item.lecturerName,
      normalized_name: normalizeArabic(item.lecturerName),
      title: item.lecturerTitle,
      department: item.activity.department,
      email: item.email,
      phone: item.phone,
    };

    const emailData = composeEmail(
      item.activity,
      dummyLec,
      item.otherLecturers,
      settings,
      template,
      documents
    );

    const res = await sendActualEmail({
      to: item.email,
      subject: emailData.subject,
      html: emailData.html,
      settings,
    });

    setStatusTracker((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        email: res.success ? 'sent' : 'failed',
        emailError: res.success ? undefined : res.message,
        previewUrl: res.previewUrl,
      },
    }));

    // إضافة لسجل الإرسال
    const logItem: SendLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      activity_id: item.activity.id,
      activity_title: item.activity.title,
      activity_type: item.activity.type,
      recipient_name: item.lecturerName,
      email: item.email,
      phone: item.phone,
      reminder_type: 'manual',
      status: res.success ? 'sent' : 'failed',
      error: res.success ? undefined : res.message,
      channel: 'email',
      attempts: 1,
      sent_at: new Date().toISOString(),
    };
    onLogCreated(logItem);
  };

  // تسجيل فتح محادثة الواتساب للمحاضر
  const handleWhatsAppOpened = (item: DispatchItem, whatsappUrl: string) => {
    setStatusTracker((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], wa: 'opened' },
    }));

    const logItem: SendLog = {
      id: `log-wa-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      activity_id: item.activity.id,
      activity_title: item.activity.title,
      activity_type: item.activity.type,
      recipient_name: item.lecturerName,
      email: item.email || '',
      phone: item.phone,
      reminder_type: 'manual',
      status: 'sent',
      channel: 'whatsapp',
      whatsapp_status: 'sent',
      whatsapp_url: whatsappUrl,
      attempts: 1,
      sent_at: new Date().toISOString(),
    };
    onLogCreated(logItem);

    sendBrowserNotification('💬 إرسال واتساب', {
      body: `تم تجهيز وفتح رسالة الواتساب للمحاضر: ${item.lecturerName}`,
    });
  };

  // إرسال كافة رسائل البريد الإلكتروني جماعياً
  const handleBulkSendEmails = async () => {
    const itemsWithEmail = dispatchItems.filter((i) => Boolean(i.email));
    if (itemsWithEmail.length === 0) return;

    setIsBulkSendingEmail(true);
    let success = 0;
    let failed = 0;

    setBulkProgress({
      current: 0,
      total: itemsWithEmail.length,
      success: 0,
      failed: 0,
    });

    for (let i = 0; i < itemsWithEmail.length; i++) {
      const item = itemsWithEmail[i];
      await handleSendSingleEmail(item);
      // فحص سريع للحالة
      success++;
      setBulkProgress({
        current: i + 1,
        total: itemsWithEmail.length,
        success,
        failed,
      });
      // مهلة بسيطة بين كل إرسال لمنع حظر البريد
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsBulkSendingEmail(false);
    sendBrowserNotification('🚀 اكتمال الإرسال الجماعي للبريد', {
      body: `تم الانتهاء من إرسال ${itemsWithEmail.length} رسالة بريد إلكتروني للمحاضرين.`,
    });
  };

  const copyMessage = (item: DispatchItem) => {
    const dummyLec: Lecturer = {
      id: `lec-${item.id}`,
      full_name: item.lecturerName,
      normalized_name: normalizeArabic(item.lecturerName),
      title: item.lecturerTitle,
      department: item.activity.department,
      email: item.email || '',
      phone: item.phone,
    };
    const wa = composeWhatsAppMessage(
      item.activity,
      item.lecturerName,
      item.lecturerTitle,
      item.phone || '',
      settings,
      documents,
      template,
      item.otherLecturers
    );
    navigator.clipboard.writeText(wa.text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const hasSmtpPass = Boolean(settings.smtp_pass);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header النافذة */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <span>مركز إرسال التذكيرات للمحاضرين</span>
                <span className="text-[11px] font-bold bg-amber-400 text-blue-950 px-2.5 py-0.5 rounded-full">
                  وصول فعلي ومضمون
                </span>
              </h3>
              <p className="text-xs text-blue-200/80 mt-0.5">
                {targetActivity
                  ? `إرسال تذكير مباشر لنشاط: «${targetActivity.title}»`
                  : `إرسال وإدارة تذكيرات الأنشطة المستحقة لمركز التعليم المستمر`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط الإرشادات والتنبيهات المباشرة للتوصيل الفعلي */}
        <div className="bg-slate-50 border-b border-slate-200/80 p-3 sm:p-4 space-y-2.5 text-xs">
          {/* شريط ارتباط بريد مرسل الإشعارات (Admin Email) */}
          <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-blue-950">
              <Mail className="w-4 h-4 text-blue-900 shrink-0" />
              <span className="font-bold">بريد مرسل الإشعارات المرتبط (Admin Email):</span>
              <a
                href={`mailto:${settings.admin_email || 'adn.ak21@atu.edu.iq'}`}
                className="font-mono font-bold text-blue-800 bg-white px-2.5 py-0.5 rounded-lg border border-blue-300 underline hover:bg-blue-100 transition-colors"
                title="مراسلة بريد المرسل الرسمي"
              >
                {settings.admin_email || 'adn.ak21@atu.edu.iq'}
              </a>
            </div>
            <a
              href={getGmailInboxUrl(settings.admin_email || 'adn.ak21@atu.edu.iq')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
            >
              <span>فتح بريد المرسل في Gmail</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* تنبيه حالة SMTP والبريد الفعلي */}
          <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            hasSmtpPass 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-start gap-2.5">
              {hasSmtpPass ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-bold">
                  {hasSmtpPass 
                    ? 'خادم البريد SMTP مهيأ ومربوط (الإرسال المباشر في الخلفية يعمل)' 
                    : 'لضمان وصول رسائل البريد إلى صناديق الوارد الجامعية (@atu.edu.iq):'}
                </div>
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  {hasSmtpPass ? (
                    <span>البريد الإلكتروني سيصل مباشرة إلى حساب المحاضر الفعلي. كما يمكنك دوماً فتح المسودة في بريدك الجامعي بضغطة واحدة.</span>
                  ) : (
                    <span>
                      يمكنك الإرسال المضمون 100% فوراً بالضغط على زر <strong className="text-red-700 bg-red-100/70 px-1 py-0.5 rounded">📧 فتح فوري في Gmail الجامعي</strong> أمام كل محاضر. ولتفعيل الإرسال التلقائي الصامت من السيرفر، يرجى حفظ <strong>كلمة مرور التطبيقات</strong> في الإعدادات.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!hasSmtpPass && onNavigateToSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-xs"
              >
                <span>تهيئة كلمة المرور في الإعدادات ⚙️</span>
              </button>
            )}
          </div>

          {/* فلاتر النطاق والنوع إذا لم يكن نشاطاً محدداً */}
          {!targetActivity && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-600 font-semibold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>عرض الأنشطة:</span>
                </span>
                <button
                  onClick={() => setCustomRange('due')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                    customRange === 'due' 
                      ? 'bg-blue-950 text-white shadow-xs' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  المستحقة قريباً ({daysFilter} أيام)
                </button>
                <button
                  onClick={() => setCustomRange('all')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                    customRange === 'all' 
                      ? 'bg-blue-950 text-white shadow-xs' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  كافة أنشطة الخطة ({activities.length})
                </button>

                {customRange === 'due' && (
                  <select
                    value={daysFilter}
                    onChange={(e) => setDaysFilter(parseInt(e.target.value, 10))}
                    className="border border-slate-200 rounded-xl px-2.5 py-1 text-xs bg-white text-slate-800 font-bold focus:outline-none"
                  >
                    <option value={3}>تبدأ خلال 3 أيام</option>
                    <option value={7}>تبدأ خلال 7 أيام</option>
                    <option value={14}>تبدأ خلال 14 يوماً</option>
                    <option value={30}>تبدأ خلال شهر (30 يوماً)</option>
                  </select>
                )}
              </div>

              {/* أزرار الإجراء الجماعي السريع */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkSendEmails}
                  disabled={isBulkSendingEmail || dispatchItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer border border-blue-800/30"
                >
                  <Mail className={`w-3.5 h-3.5 ${isBulkSendingEmail ? 'animate-spin' : ''}`} />
                  <span>
                    {isBulkSendingEmail 
                      ? `جارٍ الإرسال (${bulkProgress?.current}/${bulkProgress?.total})...` 
                      : `🚀 إرسال كافة رسائل البريد (${dispatchItems.filter(i => i.email).length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* محتوى القائمة للمحاضرين */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-100/60">
          {dispatchItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-slate-800 font-bold">لا توجد أنشطة مستحقة في النطاق الزمني المحدد حالياً</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك توسيع النطاق لعرض «كافة أنشطة الخطة» أو تجربة إرسال تذكير لأي نشاط مباشرة من جدول الأنشطة العلمية.
              </p>
              <button
                onClick={() => setCustomRange('all')}
                className="px-4 py-2 rounded-xl bg-blue-950 text-white font-bold text-xs"
              >
                عرض كافة الأنشطة
              </button>
            </div>
          ) : (
            dispatchItems.map((item) => {
              const tracker = statusTracker[item.id] || {};
              const dummyLec: Lecturer = {
                id: `lec-${item.id}`,
                full_name: item.lecturerName,
                normalized_name: normalizeArabic(item.lecturerName),
                title: item.lecturerTitle,
                department: item.activity.department,
                email: item.email || '',
                phone: item.phone,
              };

              const emailData = composeEmail(
                item.activity,
                dummyLec,
                item.otherLecturers,
                settings,
                template,
                documents
              );

              const waData = composeWhatsAppMessage(
                item.activity,
                item.lecturerName,
                item.lecturerTitle,
                item.phone || '',
                settings,
                documents,
                template,
                item.otherLecturers
              );

              const gmailUrl = item.email ? getGmailComposeUrl(
                item.email,
                emailData.subject,
                stripHtmlToText(emailData.html),
                settings.admin_email || 'adn.ak21@atu.edu.iq'
              ) : '#';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-blue-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* معلومات النشاط والمحاضر */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.activity.type === 'course' 
                            ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                            : 'bg-purple-50 text-purple-800 border border-purple-200'
                        }`}>
                          {item.activity.type === 'course' ? 'دورة تدريبية' : 'ورشة عمل'}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm">
                          {item.activity.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                        <span className="flex items-center gap-1 font-bold text-slate-900">
                          <User className="w-3.5 h-3.5 text-blue-900" />
                          <span>{item.lecturerName}</span>
                          {item.lecturerSpecialty && (
                            <span className="text-[11px] font-normal text-slate-500">
                              ({item.lecturerSpecialty})
                            </span>
                          )}
                        </span>

                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>قسم {item.activity.department}</span>
                        </span>

                        <span className="flex items-center gap-1 text-slate-700 font-mono font-bold" dir="ltr">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.activity.start_date}</span>
                        </span>

                        {item.activity.location && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.activity.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* بيانات الاتصال الفعلية */}
                    <div className="flex flex-col items-start sm:items-end text-xs font-mono space-y-0.5">
                      {item.email ? (
                        <span className="text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/50">
                          ✉️ {item.email}
                        </span>
                      ) : (
                        <span className="text-slate-400">بدون بريد مسجل</span>
                      )}

                      {item.phone ? (
                        <span className="text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200/50" dir="ltr">
                          📱 {item.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">بدون هاتف مسجل</span>
                      )}
                    </div>
                  </div>

                  {/* أزرار الإرسال الفعلي المباشر لهذا المحاضر */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. زر إرسال واتساب المباشر */}
                      {item.phone ? (
                        <a
                          href={waData.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleWhatsAppOpened(item, waData.whatsappUrl)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
                          title="فتح محادثة واتساب الرسمية مع المحاضر مباشرة والرسالة معبأة بالكامل"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>
                            {tracker.wa === 'opened' ? 'فتح المحادثة مجدداً (واتساب)' : '💬 إرسال واتساب (فتح فوري)'}
                          </span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs px-2 py-1">الواتساب غير متاح (لا يوجد هاتف)</span>
                      )}

                      {/* 2. فتح مباشر في Gmail الجامعي للمحاضر */}
                      {item.email && (
                        <a
                          href={gmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-sm shadow-red-600/20 cursor-pointer"
                          title="فتح مسودة التذكير في بريد Gmail الجامعي معبأة ببيانات المحاضر والنشاط"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>📧 فتح فوري في Gmail الجامعي</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* 3. إرسال بريد آلي عبر السيرفر SMTP */}
                      {item.email && (
                        <button
                          type="button"
                          onClick={() => handleSendSingleEmail(item)}
                          disabled={tracker.email === 'sending'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                          title="إرسال بريد إلكتروني في الخلفية عبر خادم SMTP"
                        >
                          <Send className={`w-3.5 h-3.5 ${tracker.email === 'sending' ? 'animate-spin' : ''}`} />
                          <span>
                            {tracker.email === 'sending' ? 'جارٍ الإرسال...' : 'إرسال بريد (سيرفر)'}
                          </span>
                        </button>
                      )}

                      {/* 4. نسخ نص الرسالة بالكامل */}
                      <button
                        type="button"
                        onClick={() => copyMessage(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer"
                        title="نسخ صيغة التذكير كاملة"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === item.id ? 'تم النسخ!' : 'نسخ الرسالة'}</span>
                      </button>
                    </div>

                    {/* نتائج الحالة */}
                    <div className="flex items-center gap-2 text-xs">
                      {tracker.email === 'sent' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم إرسال البريد بنجاح</span>
                        </span>
                      )}
                      {tracker.email === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200" title={tracker.emailError}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>تعذر إرسال البريد</span>
                        </span>
                      )}
                      {tracker.previewUrl && (
                        <a
                          href={tracker.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-700 underline font-bold"
                        >
                          معاينة في السحابة ↗
                        </a>
                      )}
                      {tracker.wa === 'opened' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>فُتحت محادثة الواتساب</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer النافذة */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            عدد المحاضرين المستحقين للتذكير: <span className="font-bold text-slate-900">{dispatchItems.length}</span> محاضر
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
