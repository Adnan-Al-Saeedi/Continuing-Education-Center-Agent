import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Lock,
  Mail,
  Server,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Zap,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { SmtpConfig, SmtpVerifyResult, verifySmtp, getGmailInboxUrl } from '../lib/emailService';

interface SmtpQuickTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHost?: string;
  initialPort?: number;
  initialSecure?: boolean;
  initialUser?: string;
  initialPass?: string;
  adminEmail?: string;
  onApplyCredentials: (credentials: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    smtp_pass: string;
    admin_email: string;
  }) => void;
}

export const SmtpQuickTestModal: React.FC<SmtpQuickTestModalProps> = ({
  isOpen,
  onClose,
  initialHost = 'smtp.gmail.com',
  initialPort = 465,
  initialSecure = true,
  initialUser = 'adn.ak21@atu.edu.iq',
  initialPass = '',
  adminEmail = 'adn.ak21@atu.edu.iq',
  onApplyCredentials,
}) => {
  const [host, setHost] = useState(initialHost || 'smtp.gmail.com');
  const [port, setPort] = useState<number>(initialPort || 465);
  const [secure, setSecure] = useState<boolean>(initialSecure !== undefined ? initialSecure : true);
  const [user, setUser] = useState(initialUser || adminEmail || 'adn.ak21@atu.edu.iq');
  const [pass, setPass] = useState(initialPass || '');
  const [showPassword, setShowPassword] = useState(false);

  // خيار إرسال بريد تجريبي حقيقي أثناء الفحص
  const [sendRealPing, setSendRealPing] = useState(true);
  const [testRecipient, setTestRecipient] = useState(
    adminEmail?.includes('@') ? adminEmail : 'adn.ak21@gmail.com'
  );

  // حالة الفحص والنتائج
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SmtpVerifyResult | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [copiedAdvice, setCopiedAdvice] = useState(false);

  if (!isOpen) return null;

  // قوالب الإعدادات الجاهزة المعتمدة
  const applyPreset = (preset: 'gmail_ssl' | 'gmail_tls' | 'office365' | 'custom') => {
    if (preset === 'gmail_ssl') {
      setHost('smtp.gmail.com');
      setPort(465);
      setSecure(true);
    } else if (preset === 'gmail_tls') {
      setHost('smtp.gmail.com');
      setPort(587);
      setSecure(false);
    } else if (preset === 'office365') {
      setHost('smtp.office365.com');
      setPort(587);
      setSecure(false);
    }
    setTestResult(null);
  };

  // إزالة المسافات من كلمة المرور تلقائياً
  const handleCleanPasswordSpaces = () => {
    setPass((prev) => prev.replace(/\s+/g, ''));
  };

  const hasPasswordSpaces = pass.includes(' ');

  // تنفيذ الفحص
  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setAppliedSuccess(false);

    const cleanPass = pass.replace(/\s+/g, '');

    const config: SmtpConfig & { testRecipient?: string } = {
      host: host.trim(),
      port: Number(port),
      secure,
      user: user.trim(),
      pass: cleanPass,
      testRecipient: sendRealPing && testRecipient.trim() ? testRecipient.trim() : undefined,
    };

    const res = await verifySmtp(config);
    setIsTesting(false);
    setTestResult(res);
  };

  // تطبيق البيانات المعتمدة في شاشة الإعدادات
  const handleApply = () => {
    const cleanPass = pass.replace(/\s+/g, '');
    onApplyCredentials({
      smtp_host: host.trim(),
      smtp_port: Number(port),
      smtp_secure: secure,
      smtp_user: user.trim(),
      smtp_pass: cleanPass,
      admin_email: adminEmail || user.trim(),
    });
    setAppliedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const copyGoogleGuide = () => {
    const guideText = `خطوات إنشاء كلمة مرور التطبيقات (App Password) لحساب Gmail / Google Workspace:
1. الدخول إلى إدارة حساب Google (https://myaccount.google.com)
2. الانتقال إلى تبويب "الأمان (Security)"
3. التأكد من تفعيل "التحقق بخطوتين (2-Step Verification)"
4. البحث عن خيار "كلمات مرور التطبيقات (App Passwords)"
5. كتابة اسم التطبيق (مثل: تذكيرات كلية البوليتكنك) والضغط على إنشاء
6. نسخ كلمة المرور المكونة من 16 حرفاً بدون مسافات ووضعها في خانة كلمة المرور`;
    navigator.clipboard.writeText(guideText);
    setCopiedAdvice(true);
    setTimeout(() => setCopiedAdvice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col text-right font-sans"
        dir="rtl"
      >
        {/* ترويسة النافذة */}
        <div className="p-5 border-b border-slate-150 bg-gradient-to-l from-blue-950 via-blue-900 to-indigo-950 text-white rounded-t-3xl relative">
          <button
            onClick={onClose}
            className="absolute top-5 left-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Zap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  فحص اتصال خادم البريد والتحقق من بيانات الاعتماد (SMTP Test)
                </h3>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                اختبار الاتصال المباشر والتحقق من صحة (Host, Port, User, Password) وتجربة وصول الرسالة للصندوق الوارد قبل الإرسال.
              </p>
            </div>
          </div>

          {/* شريط ارتباط بريد الإدارة */}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-blue-100">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>مرسل الإشعارات المعتمد (Admin Email):</span>
              <strong className="font-mono text-white underline">{adminEmail || user}</strong>
            </span>
            <a
              href={getGmailInboxUrl(adminEmail || user)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-all"
            >
              <span>فتح صندوق Gmail للتحقق</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* محتوى النافذة */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 1. أزرار القوالب السريعة المعتمدة */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-900" />
              <span>تعبئة سريعة لإعدادات المزودين المعتمدين:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('gmail_ssl')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer text-xs ${
                  host === 'smtp.gmail.com' && port === 465 && secure
                    ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>Google Workspace</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">Port 465 (SSL)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('gmail_tls')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer text-xs ${
                  host === 'smtp.gmail.com' && port === 587 && !secure
                    ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700'
                }`}
              >
                <div className="font-bold">Google (STARTTLS)</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">Port 587 (TLS)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('office365')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer text-xs ${
                  host === 'smtp.office365.com' && port === 587
                    ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700'
                }`}
              >
                <div className="font-bold">Microsoft 365</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">Port 587 (TLS)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700 text-right transition-all cursor-pointer text-xs"
              >
                <div className="font-bold">خادم مخصص</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Custom SMTP</div>
              </button>
            </div>
          </div>

          {/* 2. حقول بيانات الاعتماد */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
              <Server className="w-4 h-4 text-blue-900" />
              <span>بيانات خادم البريد والمصادقة (SMTP Credentials)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Host */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  خادم البريد (Host) *
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Port & Secure */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  المنفذ والتشفير (Port & Security) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 465)}
                    placeholder="465"
                    className="w-24 border border-slate-300 rounded-xl p-2.5 bg-white font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-900 cursor-pointer"
                    />
                    <span>تشفير SSL/TLS</span>
                  </label>
                </div>
              </div>

              {/* User */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  اسم المستخدم / بريد المرسل (SMTP User) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="adn.ak21@gmail.com أو adn.ak21@atu.edu.iq"
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {adminEmail && user !== adminEmail && (
                      <button
                        type="button"
                        onClick={() => setUser(adminEmail)}
                        className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                      >
                        استخدام بريد المشرف الجامعي ({adminEmail})
                      </button>
                    )}
                    {user !== 'adn.ak21@gmail.com' && (
                      <button
                        type="button"
                        onClick={() => setUser('adn.ak21@gmail.com')}
                        className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                      >
                        استخدام بريد Gmail الشخصي (adn.ak21@gmail.com)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Password / App Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">
                    كلمة مرور التطبيقات (App Password) *
                  </label>
                  {pass.length > 0 && (
                    <span className={`text-[10px] font-mono font-bold ${
                      pass.replace(/\s+/g, '').length === 16 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {pass.replace(/\s+/g, '').length === 16 ? '✓ 16 حرفاً (مثالي لجوجل)' : `${pass.replace(/\s+/g, '').length} أحرف`}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="كلمة مرور التطبيقات المكونة من 16 حرفاً"
                    className="w-full border border-slate-300 rounded-xl p-2.5 pl-10 bg-white font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {hasPasswordSpaces && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                    <span>يوجد مسافات في كلمة المرور (رمز جوجل يأتي مقسماً لـ 4 أجزاء).</span>
                    <button
                      type="button"
                      onClick={handleCleanPasswordSpaces}
                      className="font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer"
                    >
                      إزالة المسافات تلقائياً
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* خيار إرسال بريد تجريبي حقيقي أثناء الفحص */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 mb-2">
                <input
                  type="checkbox"
                  checked={sendRealPing}
                  onChange={(e) => setSendRealPing(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-900 cursor-pointer"
                />
                <span>إرسال رسالة بريد اختبارية فعلية إلى بريد مخصص للتأكد من وصولها للوارد (Inbox)</span>
              </label>

              {sendRealPing && (
                <div className="flex items-center gap-2 pr-6">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="adn.ak21@gmail.com أو أي بريد تجريبي"
                    className="flex-1 border border-slate-300 rounded-xl p-2 bg-white font-mono text-xs focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-[11px] text-slate-500 shrink-0">
                    سيتم إرسال بريد حقيقي إليه فور نجاح الاتصال
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. زر تشغيل الفحص */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting || !user || !pass}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-850 hover:from-blue-900 hover:to-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/20 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'جارٍ فحص الاتصال بالخادم والمصادقة...' : '🚀 بدء فحص الاتصال وبيانات الاعتماد'}</span>
            </button>

            <span className="text-[11px] text-slate-500 text-center sm:text-right">
              يتم الاتصال الفعلي بالخادم عبر بروتوكول SMTP والتحقق من كلمة المرور بدقة.
            </span>
          </div>

          {/* 4. لوحة النتائج والتشخيص الذكي */}
          {testResult && (
            <div className={`p-4 rounded-2xl border text-xs space-y-3 animate-in fade-in ${
              testResult.success
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/90 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-sm">
                    {testResult.success ? '🎉 نجاح الاتصال والمصادقة بالكامل!' : '❌ فشل الاتصال بخادم SMTP'}
                  </div>
                  <p className="leading-relaxed">{testResult.message}</p>

                  {/* تفاصيل نجاح الفحص */}
                  {testResult.success && testResult.details && (
                    <div className="mt-2 p-2.5 bg-white/80 rounded-xl border border-emerald-200 text-[11px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>خادم البريد:</span>
                        <span className="font-bold">{testResult.details.host}:{testResult.details.port}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المرسل المعتمد:</span>
                        <span className="font-bold">{testResult.details.user}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>زمن الاستجابة:</span>
                        <span className="font-bold">{testResult.details.responseTimeMs} ms</span>
                      </div>
                      {testResult.details.sentTestEmail && (
                        <div className="flex justify-between text-emerald-800 font-bold border-t border-emerald-100 pt-1 mt-1">
                          <span>رسالة الفحص:</span>
                          <span>تم إرسالها إلى {testRecipient} بنجاح!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* إرشادات تشخيص الأخطاء في حال الفشل */}
                  {!testResult.success && testResult.advice && (
                    <div className="mt-3 p-3 bg-white/90 rounded-xl border border-rose-200 text-slate-800 space-y-2">
                      <div className="font-bold text-xs flex items-center gap-1.5 text-rose-900">
                        <HelpCircle className="w-4 h-4 text-rose-700" />
                        <span>إرشادات حل المشكلة المقترحة:</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700">{testResult.advice}</p>

                      {/* خطوات توليد كلمة مرور التطبيقات لجوجل */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white font-bold text-[11px] transition-colors"
                        >
                          <span>فتح صفحة كلمات مرور تطبيقات Google مباشرة</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={copyGoogleGuide}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-800 hover:underline cursor-pointer"
                        >
                          {copiedAdvice ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedAdvice ? 'تم نسخ الدليل!' : 'نسخ دليل الخطوات'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* زر اعتماد وحفظ البيانات فور نجاح الفحص */}
              {testResult.success && (
                <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-800/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{appliedSuccess ? '✓ تم تطبيق وحفظ الإعدادات بنجاح!' : 'تطبيق هذه البيانات فوراً في إعدادات النظام'}</span>
                  </button>

                  <a
                    href={getGmailInboxUrl(testRecipient)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-900 hover:underline font-bold"
                  >
                    <span>فحص وصول الرسالة في صندوق الوارد ↗</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 5. دليل توضيحي خطوة بخطوة: كيفية الحصول على App Password */}
          <div className="p-4 bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/70 border border-blue-200/90 rounded-2xl text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/70 pb-2.5">
              <div className="font-bold flex items-center gap-2 text-blue-950 text-sm">
                <ShieldCheck className="w-5 h-5 text-blue-900" />
                <span>كيف تحصل على كلمة مرور التطبيقات (App Password) من Google؟</span>
              </div>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs transition-colors shadow-2xs"
              >
                <span>الانتقال المباشر لصفحة App Passwords في Google ↗</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1 shadow-2xs">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-[11px]">1</span>
                  <span>تأكد من تفعيل «التحقق بخطوتين»</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pr-6">
                  ميزة App Passwords لا تظهر إلا إذا كان حسابك مفعل عليه التحقق بخطوتين (2-Step Verification) في الأمان.
                </p>
                <div className="pr-6 pt-0.5">
                  <a
                    href="https://myaccount.google.com/signinoptions/two-step-verification"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-700 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <span>فحص حالة التحقق بخطوتين</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1 shadow-2xs">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-[11px]">2</span>
                  <span>افتح صفحة كلمات مرور التطبيقات</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pr-6">
                  اذهب إلى: <span className="font-bold text-slate-800">إدارة حساب Google ⬅️ الأمان</span> واكتب في شريط البحث بالأعلى: <strong className="text-blue-900">«App passwords»</strong> أو <strong className="text-blue-900">«كلمات مرور التطبيقات»</strong>.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1 shadow-2xs">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-[11px]">3</span>
                  <span>أنشئ كلمة مرور جديدة للنظام</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pr-6">
                  اكتب اسماً للتطبيق مثل: <span className="font-bold text-slate-800 font-mono">نظام تذكيرات البوليتكنك</span> واضغط على زر <strong className="text-blue-900">«إنشاء (Create)»</strong>.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1 shadow-2xs">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-[11px]">4</span>
                  <span>انسخ الرمز الأصفر (16 حرفاً)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pr-6">
                  سيظهر لك مربع أصفر يحتوي 16 حرفاً (مثل: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">abcd efgh ijkl mnop</code>). انسخه والصقه في حقل كلمة المرور أعلاه، وسيتم مسح المسافات تلقائياً.
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              <strong>💡 ملاحظة لحسابات نطاق جامعة الفرات الأوسط التقنية (@atu.edu.iq):</strong> إذا لم تجد خيار كلمات مرور التطبيقات، فقد يكون معطلاً من مسؤول إدارة النطاق (Google Workspace Admin). في هذه الحالة، يمكنك دائماً استخدام خيار <strong>«📧 فتح فوري في Gmail الجامعي»</strong> المتوفر في كل من تبويب القوالب وجدول الأنشطة للإرسال المباشر بنقرة زر واحدة دون الحاجة لأي كلمات مرور!
            </div>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="p-4 border-t border-slate-150 bg-slate-50 rounded-b-3xl flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <span className="text-[11px] text-slate-500">
            مركز التعليم المستمر - كلية البوليتكنك / بابل
          </span>
        </div>
      </div>
    </div>
  );
};
