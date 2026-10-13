import React, { useState, useMemo } from 'react';
import { 
  Mail, 
  Eye, 
  Send, 
  Code, 
  Sparkles, 
  RotateCcw, 
  Save,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Link as LinkIcon
} from 'lucide-react';
import { EmailTemplate, Activity, Lecturer, Settings, DocumentItem } from '../types';
import { composeEmail, composeWhatsAppMessage } from '../lib/emailComposer';
import { INITIAL_TEMPLATE } from '../lib/supabase';
import { getGmailComposeUrl, getGmailInboxUrl, getMailtoUrl, stripHtmlToText } from '../lib/emailService';

interface TemplateTabProps {
  template: EmailTemplate;
  activities: Activity[];
  lecturers: Lecturer[];
  settings: Settings;
  documents: DocumentItem[];
  onSaveTemplate: (newTemplate: EmailTemplate) => void;
  onSendTestEmail: (testEmail: string, subject: string, bodyHtml: string) => Promise<{ success: boolean; message: string; previewUrl?: string }>;
}

export const TemplateTab: React.FC<TemplateTabProps> = ({
  template,
  activities,
  lecturers,
  settings,
  documents,
  onSaveTemplate,
  onSendTestEmail,
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [previewChannel, setPreviewChannel] = useState<'email' | 'whatsapp'>('email');
  const [selectedActivityId, setSelectedActivityId] = useState<string>(activities[0]?.id || '');
  
  // استخراج المحاضرين المدمجين في الأنشطة مباشرة بدون الحاجة لدليل منفصل
  const embeddedLecturers = useMemo<Lecturer[]>(() => {
    const list: Lecturer[] = [];
    const seen = new Set<string>();

    activities.forEach((act) => {
      const name = act.lecturer_name || act.lecturers_raw;
      if (!name || seen.has(name)) return;
      seen.add(name);
      list.push({
        id: `lec-${act.id}`,
        full_name: name,
        normalized_name: name,
        title: act.lecturer_title,
        department: act.department,
        email: act.lecturer_email || `${name.replace(/\s+/g, '.')}@atu.edu.iq`,
        phone: act.lecturer_phone || '07801122334',
        specialty: act.specialty,
      });
    });

    if (list.length === 0 && lecturers.length > 0) {
      return lecturers;
    }
    return list;
  }, [activities, lecturers]);

  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(embeddedLecturers[0]?.id || '');
  const [testEmailInput, setTestEmailInput] = useState(settings.admin_email || 'adn.ak21@atu.edu.iq');
  const [testPhoneInput, setTestPhoneInput] = useState('07801122334');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; previewUrl?: string } | null>(null);
  const [copiedType, setCopiedType] = useState<'text' | 'html' | 'wa' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const copyToClipboard = (content: string, type: 'text' | 'html' | 'wa') => {
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // المتغيرات المدعومة في القالب
  const templateVariables = [
    { tag: '{{اسم_المحاضر}}', label: 'اسم المحاضر' },
    { tag: '{{اللقب}}', label: 'اللقب العلمي' },
    { tag: '{{نوع_النشاط}}', label: 'نوع النشاط (دورة / ورشة)' },
    { tag: '{{عنوان_النشاط}}', label: 'عنوان النشاط' },
    { tag: '{{القسم}}', label: 'القسم العلمي' },
    { tag: '{{تاريخ_البدء}}', label: 'تاريخ البدء' },
    { tag: '{{تاريخ_الانتهاء}}', label: 'تاريخ الانتهاء' },
    { tag: '{{يوم_البدء}}', label: 'يوم البدء (مثال: الأحد)' },
    { tag: '{{المكان}}', label: 'المكان / القاعة' },
    { tag: '{{الوقت}}', label: 'وقت البدء' },
    { tag: '{{المحاضرون_المشاركون}}', label: 'الزملاء المشاركون' },
    { tag: '{{اسم_الجامعة}}', label: 'اسم الجامعة' },
    { tag: '{{اسم_الكلية}}', label: 'اسم الكلية' },
    { tag: '{{بريد_المرسل}}', label: 'بريد مرسل الإشعارات (Admin Email)' },
    { tag: '{{قائمة_النماذج}}', label: 'قائمة النماذج والروابط' },
  ];

  // إدراج المتغير في مؤشر النص
  const insertVariable = (tag: string) => {
    setBodyHtml((prev) => prev + ` ${tag} `);
  };

  const handleSave = () => {
    onSaveTemplate({ subject, body_html: bodyHtml });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetToDefault = () => {
    setSubject(INITIAL_TEMPLATE.subject);
    setBodyHtml(INITIAL_TEMPLATE.body_html);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // توليد المعاينة الحية للبريد
  const emailPreviewData = useMemo(() => {
    const activity = activities.find((a) => a.id === selectedActivityId) || activities[0];
    const lecturer = embeddedLecturers.find((l) => l.id === selectedLecturerId) || embeddedLecturers[0];

    if (!activity || !lecturer) {
      return { subject: 'معاينة فارغة', html: '<p>يرجى إضافة نشاط ومحاضر للمعاينة</p>' };
    }

    const currentTemplate: EmailTemplate = { subject, body_html: bodyHtml };
    return composeEmail(
      activity,
      lecturer,
      ['م.م. سارة علي حسن'],
      settings,
      currentTemplate,
      documents
    );
  }, [activities, embeddedLecturers, selectedActivityId, selectedLecturerId, subject, bodyHtml, settings, documents]);

  // توليد المعاينة الحية للواتساب
  const whatsAppPreviewData = useMemo(() => {
    const activity = activities.find((a) => a.id === selectedActivityId) || activities[0];
    const lecturer = embeddedLecturers.find((l) => l.id === selectedLecturerId) || embeddedLecturers[0];

    if (!activity || !lecturer) return null;

    const currentTemplate: EmailTemplate = { subject, body_html: bodyHtml };
    return composeWhatsAppMessage(
      activity,
      lecturer.full_name,
      lecturer.title,
      testPhoneInput || lecturer.phone || '',
      settings,
      documents,
      currentTemplate,
      ['م.م. سارة علي حسن']
    );
  }, [activities, embeddedLecturers, selectedActivityId, selectedLecturerId, testPhoneInput, settings, documents, subject, bodyHtml]);

  const handleSendTest = async () => {
    if (!testEmailInput) return;
    setIsSendingTest(true);
    setTestResult(null);

    const res = await onSendTestEmail(testEmailInput, emailPreviewData.subject, emailPreviewData.html);
    setIsSendingTest(false);
    setTestResult(res);
  };

  return (
    <div className="space-y-6">
      
      {/* الترويسة وأزرار الحفظ والاستعادة */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-900" />
            محرر قوالب التذكير الأكاديمية (بريد إلكتروني وواتساب)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            صياغة ومعاينة رسائل التذكير الصادرة للبريد والواتساب بالتزامن مع دعم المتغيرات الديناميكية والنماذج.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefault}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>الافتراضي</span>
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/15 flex items-center gap-1.5 cursor-pointer border border-blue-800/30"
          >
            <Save className="w-4 h-4" />
            <span>{saveSuccess ? 'تم الحفظ!' : 'حفظ التعديلات'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-900" />
          <span>تم حفظ قالب البريد الإلكتروني الجديد بنجاح وسيعتمد في جميع الإرسالات القادمة.</span>
        </div>
      )}

      {/* شريط المتغيرات القابلة للنقر */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
        <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-900" />
          <span>انقر لإدراج المتغير التلقائي في القالب:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {templateVariables.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => insertVariable(v.tag)}
              className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer text-slate-700 font-mono"
              title={v.label}
            >
              {v.tag}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة عمودين: المحرر والمعاينة الحية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* العمود الأول: المحرر */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              عنوان الرسالة (Subject)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-slate-500" />
                <span>شفرة HTML لقالب البريد</span>
              </label>
              <span className="text-[11px] text-slate-400">يدعم تنسيقات الجداول والأنماط المضمنة</span>
            </div>
            <textarea
              rows={18}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 leading-relaxed dir-ltr"
              spellCheck={false}
            />
          </div>
        </div>

        {/* العمود الثاني: المعاينة الحية والإرسال التجريبي */}
        <div className="space-y-4">
          
          {/* محدد بيانات المعاينة والتبديل بين البريد والواتساب */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-900" />
                معاينة حية على بيانات حقيقية
              </span>

              {/* مبدل قناة المعاينة: بريد إلكتروني أو واتساب */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewChannel('email')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    previewChannel === 'email'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📧 البريد الإلكتروني
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewChannel('whatsapp')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    previewChannel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💬 رسالة الواتساب
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-500 text-[11px] mb-1">اختر النشاط للمعاينة:</label>
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-xs"
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.type === 'course' ? 'دورة' : 'ورشة'}: {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] mb-1">اختر المحاضر (مستخرج من الأنشطة):</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-xs"
                >
                  {embeddedLecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* صندوق الإرسال التجريبي للبريد */}
            {previewChannel === 'email' && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                {/* شريط مرسل الإشعارات المعتمد (Admin Email) مع الارتباط */}
                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-900" />
                      <span>مرسل الإشعارات المعتمد (Admin Email):</span>
                    </span>
                    <a
                      href={`mailto:${settings.admin_email || 'adn.ak21@atu.edu.iq'}`}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 font-mono font-bold underline transition-colors"
                      title="مراسلة بريد مرسل الإشعارات مباشرة"
                    >
                      <span>{settings.admin_email || 'adn.ak21@atu.edu.iq'}</span>
                    </a>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      <LinkIcon className="w-3 h-3 text-emerald-600" />
                      <span>مرتبط رسمياً كمرسل</span>
                    </span>
                  </div>

                  <a
                    href={getGmailInboxUrl(settings.admin_email || 'adn.ak21@atu.edu.iq')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-bold hover:underline"
                    title="فتح صندوق بريد المرسل في Google Workspace / Gmail"
                  >
                    <span>فتح بريد المرسل في Gmail</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* إرشاد توضيحي للمستخدم لوصول البريد لصندوق الوارد الفعلي */}
                <div className="p-3 bg-blue-50/80 border border-blue-200/70 rounded-2xl text-[11px] text-blue-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950 mb-1">
                    <span>💡 كيف تصلك رسالة البريد التجريبي في صندوق وارد Gmail الفعلي (@atu.edu.iq)؟</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li>
                      <strong>الخيار الفوري (الأسهل ويعمل 100% الآن):</strong> اضغط على زر <span className="font-bold text-red-700 bg-red-100/60 px-1 py-0.5 rounded">📧 فتح فوري في Gmail الجامعي</span> أدناه؛ سيفتح بريدك الجامعي مباشرة والرسالة معبأة بالكامل، ويكفي ضغط Send.
                    </li>
                    <li>
                      <strong>الإرسال الآلي المباشر من السيرفر:</strong> اضغط على تبويب <span className="font-bold text-slate-900">الإعدادات ⚙️</span> وأدخل <strong>كلمة مرور التطبيقات (App Password)</strong> الخاصة بحسابك في Google، ليعمل زر الإرسال المباشر أدناه في الخلفية.
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="email"
                    placeholder="بريد المسؤول التجريبي..."
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-mono focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={isSendingTest || !testEmailInput}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/15 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 border border-blue-800/30"
                    title="إرسال بريد تجريبي عبر خادم SMTP أو بيئة الاختبار السحابية"
                  >
                    <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-spin' : ''}`} />
                    <span>{isSendingTest ? 'جارٍ الإرسال...' : 'إرسال بريد تجريبي (SMTP)'}</span>
                  </button>
                </div>

                {/* أزرار الإرسال الفوري المباشر عبر Gmail وتطبيقات البريد والنسخ */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <a
                    href={getGmailComposeUrl(
                      testEmailInput, 
                      emailPreviewData.subject, 
                      stripHtmlToText(emailPreviewData.html),
                      settings.admin_email || 'adn.ak21@atu.edu.iq'
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-sm shadow-red-600/20 cursor-pointer"
                    title={`فتح الرسالة جاهزة للإرسال من بريد المرسل المرتبط (${settings.admin_email || 'adn.ak21@atu.edu.iq'})`}
                  >
                    <span>📧 فتح فوري في Gmail الجامعي (إرسال مضمون)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={getMailtoUrl(
                      testEmailInput, 
                      emailPreviewData.subject, 
                      stripHtmlToText(emailPreviewData.html)
                    )}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-medium transition-all cursor-pointer"
                    title="فتح في تطبيق البريد الافتراضي على جهازك"
                  >
                    <span>✉️ فتح في تطبيق البريد</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(stripHtmlToText(emailPreviewData.html), 'text')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-all cursor-pointer"
                  >
                    {copiedType === 'text' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'text' ? 'تم نسخ النص!' : 'نسخ النص'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(emailPreviewData.html, 'html')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-all cursor-pointer"
                  >
                    {copiedType === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'html' ? 'تم نسخ HTML!' : 'نسخ HTML'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* صندوق الإرسال التجريبي للواتساب */}
            {previewChannel === 'whatsapp' && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                {/* إرشاد توضيحي للمستخدم لطريقة وصول رسالة الواتساب */}
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/70 rounded-2xl text-[11px] text-emerald-950 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
                    <span>📲 كيف تجرّب وصول رسالة الواتساب إلى هاتفك؟</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    <li>
                      اكتب <strong>رقم هاتفك الفعلي</strong> في الخانة أدناه بدلاً من الرقم الافتراضي (مثال: <span className="font-mono font-bold" dir="ltr">07801234567</span>).
                    </li>
                    <li>
                      اضغط زر <span className="font-bold text-emerald-800 bg-emerald-100/60 px-1 py-0.5 rounded">فتح في واتساب وتجربة الإرسال</span>؛ سيفتح لك واتساب مع الرسالة معبأة بالكامل، ثم اضغط إرسال.
                    </li>
                    <li className="text-slate-500">
                      * ملاحظة: شركة واتساب (Meta) تمنع تقنياً أي موقع خارجي من إرسال رسائل خفية لهواتف الأشخاص تلقائياً بدون فتح التطبيق حمايةً للمستخدمين من الاحتيال والإزعاج.
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="اكتب رقم هاتفك الفعلي (07xxxxxxxx)..."
                    value={testPhoneInput}
                    onChange={(e) => setTestPhoneInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-mono focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    dir="ltr"
                  />
                  {whatsAppPreviewData && (
                    <a
                      href={whatsAppPreviewData.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح في واتساب وتجربة الإرسال</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => whatsAppPreviewData && copyToClipboard(whatsAppPreviewData.text, 'wa')}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedType === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'wa' ? 'تم النسخ!' : 'نسخ نص الواتساب'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${settings.whatsapp_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  <span>حالة خدمة الواتساب: {settings.whatsapp_enabled ? 'مفعّلة (تُرسل بالتزامن مع كل تذكير)' : 'معطلة (يمكنك تفعيلها من الإعدادات أو الشاشة الرئيسية)'}</span>
                </div>
              </div>
            )}

            {testResult && (
              <div className={`p-3 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.previewUrl && (
                  <a
                    href={testResult.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline shrink-0 bg-white px-2 py-1 rounded-lg border border-emerald-200"
                  >
                    <span>معاينة البريد في صندوق الاختبار ↗</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* شاشة العرض النهائية للرسالة (بريد أو واتساب) */}
          {previewChannel === 'email' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-200 p-3 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500">
                    مرسل الإشعارات (Admin Email):{' '}
                    <a
                      href={`mailto:${settings.admin_email || 'adn.ak21@atu.edu.iq'}`}
                      className="font-mono font-bold text-blue-700 underline hover:text-blue-900"
                    >
                      {settings.admin_email || 'adn.ak21@atu.edu.iq'}
                    </a>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                    🔗 مرتبط كمرسل رسمي
                  </span>
                </div>
                <div className="text-slate-500">
                  الموضوع المعاين:{' '}
                  <span className="font-bold text-slate-900">{emailPreviewData.subject}</span>
                </div>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto bg-slate-50/50">
                <div
                  className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white"
                  dangerouslySetInnerHTML={{ __html: emailPreviewData.html }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-emerald-700 text-white p-3.5 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span>💬</span>
                  <span>معاينة رسالة الواتساب المتزامنة (WhatsApp Markdown)</span>
                </div>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-normal">
                  تُرسل في نفس الوقت
                </span>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto bg-[#efeae2]/40">
                <div className="max-w-md bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans relative">
                  {whatsAppPreviewData?.text}
                  <div className="text-[10px] text-slate-400 text-left mt-2 flex items-center justify-end gap-1">
                    <span>10:00 ص</span>
                    <span className="text-sky-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
