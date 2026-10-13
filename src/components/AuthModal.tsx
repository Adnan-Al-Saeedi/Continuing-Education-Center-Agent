import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Sparkles,
  ArrowRight,
  KeyRound,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthenticated, loginWithPassword } = useAuth();

  const [email, setEmail] = useState('adn.ak21@atu.edu.iq');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // إذا كان المستخدم مصادقاً عليه، لا نظهر النافذة
  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const res = await loginWithPassword(email, password);
    if (!res.success) {
      setErrorMessage(res.error || 'بيانات الدخول غير صحيحة.');
    }

    setIsLoading(false);
  };

  const handleFillAdminCredentials = () => {
    setEmail('adn.ak21@atu.edu.iq');
    setPassword('570390');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden text-right font-sans"
        dir="rtl"
      >
        {/* الترويسة الأكاديمية الرسمية */}
        <div className="p-6 bg-gradient-to-l from-blue-950 via-blue-900 to-indigo-950 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-blue-200 tracking-wide">
                جامعة الفرات الأوسط التقنية • كلية البوليتكنك - بابل
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                المساعد الرقمي لمركز التعليم المستمر
              </h2>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-blue-100 flex items-center justify-between">
            <span>بوابة تسجيل الدخول الرسمية</span>
            <span className="text-[11px] text-emerald-300 font-bold bg-white/10 px-2 py-0.5 rounded-full">
              محمي بنظام الصلاحيات
            </span>
          </div>
        </div>

        {/* نموذج تسجيل الدخول المباشر (بدون OTP) */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
            صلاحية الدخول للنظام محصورة بـ <strong>مسؤول النظام الرئيسي</strong> والمستخدمين المصرح لهم المعتمدين في خانة الإعدادات فقط.
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* البريد الإلكتروني */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                البريد الإلكتروني المعتمد *
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adn.ak21@atu.edu.iq"
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 pl-9 bg-white font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">
                  كلمة المرور *
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 pl-9 bg-white font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
            </div>

            {/* زر تسجيل الدخول المباشر */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-850 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/20 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>جارٍ التحقق من الصلاحيات...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>تسجيل الدخول إلى النظام</span>
                </>
              )}
            </button>
          </form>

          {/* بطاقة تعبئة سريعة لمسؤول النظام المعتمد */}
          <div className="pt-2 border-t border-slate-150">
            <button
              type="button"
              onClick={handleFillAdminCredentials}
              className="w-full p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-blue-950 text-[11px] font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-900" />
                <span>تعبئة بيانات مسؤول النظام الرئيسي (adn.ak21@atu.edu.iq)</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-150 text-[11px] text-slate-500 text-center">
          مركز التعليم المستمر • الخطة السنوية 2026-2027
        </div>
      </div>
    </div>
  );
};
