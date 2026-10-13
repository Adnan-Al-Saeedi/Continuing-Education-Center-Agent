import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  FileCode,
  Sliders,
  Mail,
  Globe,
  Sparkles,
  Link as LinkIcon,
  Bell,
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  ExternalLink,
  Zap,
  UserPlus,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Edit3,
  ShieldAlert
} from 'lucide-react';
import { Settings, SystemUser } from '../types';
import { 
  verifySmtp, 
  sendBrowserNotification, 
  getNotificationPermissionStatus, 
  requestNotificationPermission,
  getGmailInboxUrl
} from '../lib/emailService';
import { SmtpQuickTestModal } from './SmtpQuickTestModal';
import { useAuth } from '../context/AuthContext';

interface SettingsTabProps {
  settings: Settings;
  onSaveSettings: (newSettings: Settings) => void;
  onReloadPolytechnic?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSaveSettings,
  onReloadPolytechnic,
}) => {
  const { admin } = useAuth();
  const isSuperAdmin = Boolean(admin?.isSuperAdmin || admin?.role === 'super_admin');

  const [formData, setFormData] = useState<Settings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>(getNotificationPermissionStatus());

  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white rounded-3xl p-8 border border-rose-200 text-center shadow-lg shadow-rose-950/5" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-2">
          صلاحية الوصول للإعدادات العامة مقيدة
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          صفحة الإعدادات العامة وإدارة الخوادم والمستخدمين متاحة حصراً لمسؤول النظام العام (Super Admin).
        </p>
      </div>
    );
  }

  // إدارة المستخدمين وصلاحيات الدخول
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'editor'>('staff');
  const [userIsActive, setUserIsActive] = useState(true);
  const [showUserPasswordInput, setShowUserPasswordInput] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<{ [userId: string]: boolean }>({});

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);

  const handleLogoFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLogoError('يرجى اختيار ملف صورة صالح (PNG, JPG, JPEG, SVG, WebP)');
      return;
    }
    setLogoError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      // For SVG or small files (< 120KB), keep as-is
      if (file.type === 'image/svg+xml' || file.size < 120000) {
        handleChange('logo_url', result);
        return;
      }

      // Optimize/scale down image if larger to ensure fast performance & fitting cleanly in localStorage
      const img = new Image();
      img.onload = () => {
        const maxDim = 400; // 400px is optimal for crisp university logo badges
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimized = canvas.toDataURL('image/png', 0.92);
          handleChange('logo_url', optimized);
        } else {
          handleChange('logo_url', result);
        }
      };
      img.onerror = () => {
        handleChange('logo_url', result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLogoFileUpload(file);
    }
  };

  const handleRemoveLogo = () => {
    handleChange('logo_url', '');
    setLogoError(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
  };

  const handleChange = (field: keyof Settings, value: any) => {
    setFormData((prev) => {
      if (field === 'admin_email') {
        const shouldSyncOthers = !prev.smtp_user || prev.smtp_user === prev.admin_email;
        return {
          ...prev,
          admin_email: value,
          reply_to: prev.reply_to === prev.admin_email || !prev.reply_to ? value : prev.reply_to,
          smtp_user: shouldSyncOthers ? value : prev.smtp_user,
        };
      }
      if (field === 'smtp_user') {
        return {
          ...prev,
          smtp_user: value,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);

    const res = await verifySmtp({
      host: formData.smtp_host || 'smtp.gmail.com',
      port: formData.smtp_port || 465,
      secure: formData.smtp_secure !== undefined ? formData.smtp_secure : true,
      user: formData.smtp_user || formData.admin_email,
      pass: formData.smtp_pass,
    });

    setIsTestingSmtp(false);
    setSmtpTestResult(res);

    if (res.success) {
      sendBrowserNotification('✅ فحص خادم البريد SMTP', {
        body: 'تم الاتصال بنجاح بخادم البريد، الإرسال التلقائي جاهز للعمل!',
      });
    }
  };

  const handleApplySmtpCredentials = (credentials: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    smtp_pass: string;
    admin_email: string;
  }) => {
    const updated: Settings = {
      ...formData,
      ...credentials,
      reply_to: credentials.admin_email,
    };
    setFormData(updated);
    onSaveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
    sendBrowserNotification('✅ تم اعتماد بيانات خادم SMTP', {
      body: `تم تطبيق وحفظ بيانات الخادم (${credentials.smtp_host}) والمرسل (${credentials.admin_email}) بنجاح.`,
    });
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(getNotificationPermissionStatus());
    if (granted) {
      sendBrowserNotification('🔔 تم تفعيل إشعارات المساعد الرقمي', {
        body: 'ستصلك الآن تنبيهات التذكيرات وتقارير الإرسال اليومية مباشرة على سطح المكتب!',
      });
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserEmail('');
    setUserName('');
    setUserPassword('');
    setUserRole('staff');
    setUserIsActive(true);
    setUserFormError(null);
    setShowUserPasswordInput(false);
    setShowAddUserModal(true);
  };

  const handleOpenEditUser = (u: SystemUser) => {
    setEditingUserId(u.id);
    setUserEmail(u.email);
    setUserName(u.name);
    setUserPassword(u.password);
    setUserRole(u.role === 'super_admin' ? 'admin' : u.role);
    setUserIsActive(u.is_active !== false);
    setUserFormError(null);
    setShowUserPasswordInput(false);
    setShowAddUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const cleanEmail = userEmail.trim().toLowerCase();
    const cleanPass = userPassword.trim();
    const cleanName = userName.trim();

    if (!cleanEmail || !cleanPass || !cleanName) {
      setUserFormError('يرجى ملء جميع الحقول المطلوبة (الاسم، البريد، كلمة المرور).');
      return;
    }

    const currentUsers: SystemUser[] = formData.authorized_users || [];
    
    // فحص عدم تكرار البريد مع مستخدم آخر
    const isDuplicate = currentUsers.some(
      (u) => u.email.toLowerCase() === cleanEmail && u.id !== editingUserId
    );
    if (isDuplicate || (cleanEmail === 'adn.ak21@atu.edu.iq' && editingUserId !== 'super-admin-primary')) {
      setUserFormError('هذا البريد الإلكتروني مسجل مسبقاً في النظام.');
      return;
    }

    const roleLabels: Record<string, string> = {
      admin: 'مسؤول إداري (Admin)',
      staff: 'مشرف أنشطة (Staff)',
      editor: 'مدخل بيانات (Data Entry)',
    };

    let updatedUsers: SystemUser[];
    if (editingUserId) {
      updatedUsers = currentUsers.map((u) => {
        if (u.id === editingUserId) {
          return {
            ...u,
            email: cleanEmail,
            name: cleanName,
            password: cleanPass,
            role: userRole,
            role_label: roleLabels[userRole] || 'مستخدم مصرح له',
            is_active: userIsActive,
            updated_at: new Date().toISOString(),
          };
        }
        return u;
      });
    } else {
      const newUser: SystemUser = {
        id: `user-${Date.now()}`,
        email: cleanEmail,
        name: cleanName,
        password: cleanPass,
        role: userRole,
        role_label: roleLabels[userRole] || 'مستخدم مصرح له',
        is_active: userIsActive,
        created_at: new Date().toISOString(),
      };
      updatedUsers = [...currentUsers, newUser];
    }

    const updatedFormData = {
      ...formData,
      authorized_users: updatedUsers,
    };
    setFormData(updatedFormData);
    onSaveSettings(updatedFormData);
    setShowAddUserModal(false);
    sendBrowserNotification('👥 إدارة المستخدمين', {
      body: `تم ${editingUserId ? 'تعديل بيانات' : 'إضافة'} المستخدم (${cleanName}) بنجاح.`,
    });
  };

  const handleToggleUserStatus = (userId: string) => {
    const currentUsers = formData.authorized_users || [];
    const updatedUsers = currentUsers.map((u) => {
      if (u.id === userId) {
        return { ...u, is_active: !u.is_active };
      }
      return u;
    });

    const updated = { ...formData, authorized_users: updatedUsers };
    setFormData(updated);
    onSaveSettings(updated);
  };

  const handleDeleteUser = (userId: string, email: string) => {
    if (email.toLowerCase() === 'adn.ak21@atu.edu.iq') {
      alert('لا يمكن حذف حساب مسؤول النظام الرئيسي.');
      return;
    }

    const currentUsers = formData.authorized_users || [];
    const updatedUsers = currentUsers.filter((u) => u.id !== userId);
    const updated = { ...formData, authorized_users: updatedUsers };
    setFormData(updated);
    onSaveSettings(updated);
    sendBrowserNotification('👥 حذف مستخدم', {
      body: `تم حذف المستخدم (${email}) وسحب صلاحية دخوله للنظام.`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* الترويسة */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-900" />
            الإعدادات العامة وهوية المؤسسة
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            تخصيص هوية المؤسسة الأكاديمية وتحميل الشعار وتوقيت التذكيرات الآلية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSmtpModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-amber-300 shadow-2xs"
            title="فحص سريع لاتصال خادم البريد (SMTP) والتحقق من بيانات الاعتماد"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            <span>فحص خادم البريد (SMTP)</span>
          </button>

          {onReloadPolytechnic && (
            <button
              type="button"
              onClick={onReloadPolytechnic}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="استعادة بيانات وإعدادات كلية البوليتكنك - بابل الرسمية"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-900" />
              <span>استعادة بيانات كلية البوليتكنك (2026-2027)</span>
            </button>
          )}

          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/15 flex items-center gap-2 cursor-pointer shrink-0 border border-blue-800/30"
          >
            <Save className="w-4 h-4" />
            <span>{saveSuccess ? 'تم حفظ التغييرات!' : 'حفظ جميع الإعدادات'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-900" />
          <span>تم حفظ كافة الإعدادات بنجاح في قاعدة البيانات والتخزين المحلي.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 1. هوية المؤسسة والكلية والمركز */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sliders className="w-4 h-4 text-blue-900" />
            هوية المؤسسة والمركز (تظهر في الترويسة وقالب البريد)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">اسم الجامعة *</label>
              <input
                type="text"
                value={formData.university_name}
                onChange={(e) => handleChange('university_name', e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">اسم الكلية / المعهد *</label>
              <input
                type="text"
                value={formData.college_name}
                onChange={(e) => handleChange('college_name', e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">اسم الشعبة / المركز *</label>
              <input
                type="text"
                value={formData.center_name}
                onChange={(e) => handleChange('center_name', e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-800 font-bold text-xs">
                  شعار الكلية / المركز (تحميل صورة الشعار)
                </label>
                <span className="text-[11px] text-slate-400">
                  يظهر في الترويسة العليا وفي رسائل التذكير
                </span>
              </div>
              
              {/* مدخل ملف الصورة المخفي */}
              <input 
                type="file"
                ref={logoFileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
              />

              {formData.logo_url ? (
                /* بطاقة معاينة الشعار المحمّل */
                <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                      <img 
                        src={formData.logo_url} 
                        alt="معاينة الشعار" 
                        className="w-full h-full object-contain" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>تم تحميل صورة الشعار بنجاح</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        صورة الشعار مفعلة وجاهزة وتظهر فوراً في ترويسة التطبيق والتقارير.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>تغيير صورة الشعار</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all cursor-pointer"
                      title="حذف الشعار"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* منطقة السحب والإفلات لاختيار الشعار */
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                  onDragLeave={() => setIsDraggingLogo(false)}
                  onDrop={handleDrop}
                  onClick={() => logoFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDraggingLogo 
                      ? 'border-blue-600 bg-blue-50/70 scale-[1.01]' 
                      : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/70 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-900 mb-2 shadow-2xs">
                    <Upload className="w-6 h-6 text-blue-900" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    انقر هنا لاختيار صورة الشعار من جهازك، أو اسحب الصورة وأفلتها هنا
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    صيغ الصور المدعومة: PNG, JPG, JPEG, SVG, WebP (يتم التحجيم والضبط التلقائي)
                  </div>
                </div>
              )}

              {logoError && (
                <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{logoError}</span>
                </div>
              )}

              {/* خيار إضافي مرن لإدخال رابط يدوي عند الحاجة */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualUrl(!showManualUrl)}
                  className="text-[11px] text-slate-500 hover:text-blue-700 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>{showManualUrl ? 'إخفاء خيار الرابط الخارجي' : 'أو إدخال رابط الشعار يدوياً (Logo URL)'}</span>
                </button>
                {showManualUrl && (
                  <div className="mt-2">
                    <input
                      type="url"
                      value={formData.logo_url || ''}
                      onChange={(e) => handleChange('logo_url', e.target.value)}
                      placeholder="https://.../logo.png"
                      className="w-full border border-slate-300 rounded-xl p-2 text-xs bg-white font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-slate-900 font-bold text-xs flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-900" />
                  <span>بريد استلام تقرير الملخص اليومي (Admin Email) — مرسل الإشعارات المعتمد</span>
                </label>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold">
                  <LinkIcon className="w-3 h-3 text-emerald-700" />
                  <span>مرتبط كمرسل رسمي للإشعارات</span>
                </span>
              </div>

              <input
                type="email"
                value={formData.admin_email || ''}
                onChange={(e) => handleChange('admin_email', e.target.value)}
                placeholder="adn.ak21@atu.edu.iq"
                className="w-full border border-blue-300 rounded-xl p-2.5 bg-white font-mono text-xs font-bold text-blue-950 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />

              {formData.admin_email && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-600 font-medium">ارتباط البريد الفعال:</span>
                    <a
                      href={`mailto:${formData.admin_email}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold underline transition-colors"
                      title="مراسلة بريد مرسل الإشعارات مباشرة"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{formData.admin_email}</span>
                    </a>
                    <a
                      href={getGmailInboxUrl(formData.admin_email)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-2xs"
                      title="فتح صندوق بريد المرسل في Google Workspace / Gmail"
                    >
                      <span>فتح بريد المرسل في Gmail</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <span className="text-emerald-800 font-semibold">
                    ✓ يتم إرسال جميع الإشعارات والتذكيرات واستقبال الردود عبر هذا البريد المرتبط
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. إعدادات الإرسال ومفاتيح تفعيل وتعطيل الخدمات */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-900" />
                الخدمة العامة للرسائل والتذكيرات الآلية
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                المفتاح الرئيسي لتشغيل أو إيقاف التذكيرات التلقائية الصباحية وفحص الأنشطة المستحقة.
              </p>
            </div>

            {/* مفتاح الخدمة العامة بنمط أبل */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formData.messaging_service_active}
                onChange={(e) => handleChange('messaging_service_active', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ms-3 text-xs font-bold text-slate-800">
                {formData.messaging_service_active ? 'مفعّلة 🔔' : 'متوقفة ⏸️'}
              </span>
            </label>
          </div>

          {/* مفتاح خدمة البريد الإلكتروني المستقل */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50/40 border border-blue-200/60 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center text-sm">
                📧
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">خدمة رسائل البريد الإلكتروني</h5>
                <p className="text-[11px] text-slate-500">إرسال خطابات التذكير الرسمية والمرفقات إلى البريد الإلكتروني للمحاضرين.</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formData.email_enabled}
                onChange={(e) => handleChange('email_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ms-3 text-xs font-bold text-slate-800">
                {formData.email_enabled ? 'مفعّلة 📧' : 'معطّلة ⚪'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">اسم المرسل (Sender Name) *</label>
              <input
                type="text"
                value={formData.sender_name}
                onChange={(e) => handleChange('sender_name', e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">بريد المرسل واستقبال الردود (Linked Admin Email) *</label>
                {formData.admin_email && (
                  <a
                    href={`mailto:${formData.admin_email}`}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline font-mono font-bold"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>مرتبط بـ: {formData.admin_email}</span>
                  </a>
                )}
              </div>
              <input
                type="email"
                value={formData.admin_email || formData.reply_to}
                onChange={(e) => handleChange('admin_email', e.target.value)}
                required
                className="w-full border border-blue-200 rounded-xl p-2.5 bg-blue-50/30 font-mono font-bold text-blue-950 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                عدد الأيام قبل بدء النشاط للتذكير الأول *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.days_before}
                  onChange={(e) => handleChange('days_before', parseInt(e.target.value, 10) || 7)}
                  required
                  className="w-28 border border-slate-300 rounded-xl p-2.5 bg-white font-mono font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <span className="text-slate-500">أيام قبل النشاط (افتراضياً: 7 أيام)</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                تفعيل تذكير ثانٍ إضافي قبل يوم واحد
              </label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="second_reminder_chk"
                  checked={formData.second_reminder}
                  onChange={(e) => handleChange('second_reminder', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-900 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="second_reminder_chk" className="text-xs text-slate-700 cursor-pointer font-medium">
                  إرسال تذكير ثانٍ للمحاضر قبل يوم واحد (24 ساعة) من بدء النشاط
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 4. خدمة إرسال التذكيرات عبر واتساب (WhatsApp Messaging) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                خدمة الإرسال عبر واتساب (WhatsApp Messaging)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                إرسال رسائل التذكير والمرفقات إلى رقم هاتف المحاضر عبر واتساب بالتزامن مع إرسال البريد الإلكتروني.
              </p>
            </div>

            {/* مفتاح التفعيل / الإيقاف الرئيسي لواتساب بنمط أبل */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formData.whatsapp_enabled}
                onChange={(e) => handleChange('whatsapp_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ms-3 text-xs font-bold text-slate-800">
                {formData.whatsapp_enabled ? 'مفعّلة 💬' : 'معطّلة ⚪'}
              </span>
            </label>
          </div>

          {formData.whatsapp_enabled ? (
            <div className="space-y-4 pt-1 animate-in fade-in">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>الخدمة مفعّلة: سيتم إرسال رسائل التذكير الأكاديمية إلى أرقام هواتف المحاضرين عبر واتساب بالتزامن مع البريد الإلكتروني.</span>
              </div>

              {/* نمط الإرسال */}
              <div className="text-xs space-y-2">
                <label className="block text-slate-700 font-semibold">نمط إرسال الواتساب</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => handleChange('whatsapp_mode', 'direct')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      (formData.whatsapp_mode || 'direct') === 'direct'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>واتساب المباشر (Direct WhatsApp Web / App)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      توليد روابط محادثة واتساب الرسمية (wa.me) معبأة مسبقاً بالنص والمرفقات للأرقام المعتمدة مع إمكانية الإرسال الفوري بنقرة زر واحدة دون الحاجة لاشتراكات أو بوابات مدفوعة.
                    </p>
                  </div>

                  <div
                    onClick={() => handleChange('whatsapp_mode', 'api')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      formData.whatsapp_mode === 'api'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>بوابة WhatsApp Cloud API (أتمتة سحابية)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      ربط بوابة API مخصصة (مثل Meta Cloud API أو UltraMsg أو Twilio) للإرسال التلقائي عبر السيرفر دون تدخل بشري.
                    </p>
                  </div>
                </div>
              </div>

              {formData.whatsapp_mode === 'api' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">عنوان بوابة API (Webhook / URL)</label>
                    <input
                      type="url"
                      value={formData.whatsapp_api_url || ''}
                      onChange={(e) => handleChange('whatsapp_api_url', e.target.value)}
                      placeholder="https://api.ultramsg.com/instance... أو Meta API"
                      className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">مفتاح المصادقة (API Token / Key)</label>
                    <input
                      type="password"
                      value={formData.whatsapp_api_token || ''}
                      onChange={(e) => handleChange('whatsapp_api_token', e.target.value)}
                      placeholder="Token..."
                      className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* معاينة شكل رسالة الواتساب */}
              <div className="pt-2">
                <label className="block text-slate-700 font-semibold text-xs mb-2">
                  معاينة نموذج رسالة الواتساب الأكاديمية الرسمية:
                </label>
                <div className="p-4 bg-emerald-950/5 border border-emerald-200/80 rounded-2xl text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-line max-w-lg shadow-inner">
                  {`السلام عليكم ورحمة الله وبركاته،
تحية طيبة سعادة *م.د. محمد نوري سعيد* المحترم،

نود تذكيركم بموعد إقامة *الدورة التدريبية*:
📌 *«تطبيقات الذكاء الاصطناعي التوليدي في التعليم الجامعي»*

🏛️ *القسم العلمي:* قسم تقنيات الحاسوب ونظم المعلومات
📅 *تاريخ البدء:* 2026/10/18
⏳ *تاريخ الانتهاء:* 2026/10/22
📍 *المكان:* مختبر الذكاء الاصطناعي والحوسبة السحابية
⏰ *الوقت:* 10:00 صباحاً

📋 *النماذج والوثائق المطلوبة:*
1. *استمارة الأمر الإداري*: https://drive.google.com/...

مع التقدير والاعتزاز،
*${formData.sender_name || formData.center_name}*
_${formData.college_name} - ${formData.university_name}_`}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
              خدمة الواتساب معطلة حالياً. عند إرسال التذكيرات، سيتم الإرسال عبر البريد الإلكتروني فقط. قم بتفعيل المفتاح أعلاه لإرسال الإشعارات عبر واتساب والبريد معاً في نفس الوقت.
            </div>
          )}
        </div>

        {/* 5. إعدادات خادم البريد المباشر واختبار الاتصال (SMTP Configuration) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-900" />
                إعدادات خادم البريد الإلكتروني (SMTP Settings)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تكوين بيانات خادم البريد للإرسال التلقائي المباشر للرسائل والتذكيرات دون الحاجة لفتح المتصفح يدوياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSmtpModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white border border-blue-800/40 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>نافذة الفحص السريع والتحقق (SMTP Test)</span>
              </button>

              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                title="فحص الاتصال المباشر بالقيم الحالية"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSmtp ? 'animate-spin' : ''}`} />
                <span>{isTestingSmtp ? 'جارٍ الفحص...' : 'فحص فوري'}</span>
              </button>
            </div>
          </div>

          {/* شريط الإرشاد السريع لفتح نافذة الاختبار */}
          <div className="p-3 bg-gradient-to-l from-amber-50 to-blue-50/50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                ⚡
              </div>
              <p className="text-slate-800 leading-relaxed">
                <strong>التحقق السريع قبل الإرسال:</strong> استخدم نافذة الفحص السريع لاختبار اتصال خادم البريد والتأكد من قبول كلمة مرور التطبيقات وإرسال بريد تجريبي مباشر إلى صندوقك للتأكد من وصوله.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSmtpModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              فتح نافذة الفحص ↗
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">خادم البريد (SMTP Host)</label>
              <input
                type="text"
                value={formData.smtp_host || 'smtp.gmail.com'}
                onChange={(e) => handleChange('smtp_host', e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">المنفذ (SMTP Port)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formData.smtp_port || 465}
                  onChange={(e) => handleChange('smtp_port', parseInt(e.target.value, 10) || 465)}
                  placeholder="465"
                  className="w-28 border border-slate-300 rounded-xl p-2.5 bg-white font-mono font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.smtp_secure !== false}
                    onChange={(e) => handleChange('smtp_secure', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900"
                  />
                  <span>اتصال آمن ومشفّر (SSL/TLS)</span>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">حساب خادم الإرسال (SMTP User / Gmail)</label>
                <span className="text-[11px] text-slate-500">
                  يمكن استخدام بريد Gmail شخصي (@gmail.com) أو الجامعي
                </span>
              </div>
              <input
                type="email"
                value={formData.smtp_user || formData.admin_email || ''}
                onChange={(e) => handleChange('smtp_user', e.target.value)}
                placeholder="adn.ak21@gmail.com أو adn.ak21@atu.edu.iq"
                className="w-full border border-blue-200 rounded-xl p-2.5 bg-blue-50/30 font-mono font-bold text-blue-950 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                💡 <strong>حل مثالي:</strong> يمكنك إدخال بريدك الشخصي في Google (مثل <span className="font-mono font-bold text-blue-900">adn.ak21@gmail.com</span>) وتوليد كلمة مرور التطبيقات من حسابه الشخصي بدون أي قيود جامعية.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                كلمة المرور أو كلمة مرور التطبيقات (App Password)
              </label>
              <input
                type="password"
                value={formData.smtp_pass || ''}
                onChange={(e) => handleChange('smtp_pass', e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-950 leading-relaxed space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <span>💡 حسابات Google Workspace وجامعة الفرات الأوسط التقنية (@atu.edu.iq):</span>
              </div>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold text-[11px] transition-colors shadow-2xs"
              >
                <span>فتح صفحة App Passwords في Google مباشرة ↗</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-700">
              يتطلب خادم Google توليد <strong>كلمة مرور تطبيقات (App Password)</strong> مكونة من 16 حرفاً بدلاً من كلمة المرور العادية:
              <br />
              <strong>1.</strong> فعّل «التحقق بخطوتين» في أمان حساب Google. 
              <strong> 2.</strong> افتح صفحة «كلمات مرور التطبيقات (App passwords)». 
              <strong> 3.</strong> أنشئ كلمة مرور باسم «نظام التذكيرات» وانسخ الـ 16 حرفاً وضعها في خانة كلمة المرور أعلاه.
            </p>
          </div>

          {smtpTestResult && (
            <div className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 ${
              smtpTestResult.success 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {smtpTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{smtpTestResult.message}</span>
            </div>
          )}
        </div>

        {/* 6. إشعارات النظام والمتصفح الفورية (Desktop & Push Notifications) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-900" />
                إشعارات سطح المكتب والمتصفح الفورية (Desktop Notifications)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                استقبال تنبيهات مرئية وصوتية على حاسوبك فور إرسال رسائل التذكير، أو وصول بريد تجريبي، أو حدوث خطأ في المزامنة.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                notificationStatus === 'granted' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : notificationStatus === 'denied'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  notificationStatus === 'granted' ? 'bg-emerald-500' : notificationStatus === 'denied' ? 'bg-rose-500' : 'bg-amber-500'
                }`}></span>
                <span>
                  {notificationStatus === 'granted' ? 'مفعلة ومصرحة' : notificationStatus === 'denied' ? 'محظورة بالمتصفح' : 'بحاجة إلى إذن'}
                </span>
              </span>

              {notificationStatus !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="px-3.5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  تفعيل الإشعارات الآن 🔔
                </button>
              )}

              {notificationStatus === 'granted' && (
                <button
                  type="button"
                  onClick={() => {
                    sendBrowserNotification('تجربة إشعار المساعد الرقمي 🔔', {
                      body: 'هذا إشعار تجريبي يثبت أن نظام الإشعارات يعمل بشكل سليم على جهازك!',
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  إرسال إشعار تجريبي 🔔
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            عند تفعيل الإشعارات، سيعلمك النظام فورياً عند انتهاء عمليات الإرسال المزدوج (بريد + واتساب) وعند نجاح أو تعثر إرسال التذكيرات للمحاضرين.
          </p>
        </div>

        {/* 7. إدارة المستخدمين وصلاحيات الدخول إلى النظام (User Management & Access Control) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-900" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  إدارة المستخدمين وصلاحيات الدخول إلى النظام (User Management & Access Control)
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد من يحق له الدخول للنظام وإدارة كلمات المرور والأدوار. صلاحية الدخول محصورة بالمسؤول الرئيسي والمستخدمين المعتمدين هنا.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>

          {/* تنويه الأمان وسياسة الدخول */}
          <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-2xl text-[11px] text-blue-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>سياسة الأمان الصارمة:</strong> تم إلغاء رمز التحقق OTP؛ وأصبح الدخول للنظام مقتصراً حصرياً على <strong>مسؤول النظام الرئيسي</strong> (المثبت أدناه) وأي مستخدم يقوم المسؤول بإضافته في هذا الجدول مع كلمة المرور المحددة له.
            </p>
          </div>

          {/* جدول وبطاقات المستخدمين */}
          <div className="space-y-3">
            {/* حساب مسؤول النظام الرئيسي الدائم */}
            <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-50/60 via-slate-50 to-blue-50/40 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                  👑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">مسؤول النظام الرئيسي</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                      Super Admin (دائم)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                      نشط دائماً
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-950 mt-0.5">
                    adn.ak21@atu.edu.iq
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono">
                  <span className="text-slate-500 text-[11px]">كلمة المرور:</span>
                  <span className="font-bold text-slate-900">
                    {visiblePasswords['super-admin'] ? '570390' : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('super-admin')}
                    className="text-slate-400 hover:text-slate-600 mr-1 cursor-pointer"
                    title={visiblePasswords['super-admin'] ? 'إخفاء' : 'إظهار'}
                  >
                    {visiblePasswords['super-admin'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* قائمة المستخدمين الإضافيين المضافين */}
            {(!formData.authorized_users || formData.authorized_users.filter(u => u.email.toLowerCase() !== 'adn.ak21@atu.edu.iq').length === 0) ? (
              <div className="p-6 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  لم تتم إضافة مستخدمين فرعيين بعد
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  يمكن لمسؤول النظام إضافة موظفين أو مساعدين من مركز التعليم المستمر وتحديد بريدهم وكلمة المرور الخاصة بهم للسماح لهم بالدخول للنظام.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddUser}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة أول مستخدم الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {formData.authorized_users
                  .filter((u) => u.email.toLowerCase() !== 'adn.ak21@atu.edu.iq')
                  .map((u) => (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        u.is_active !== false
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          u.is_active !== false ? 'bg-blue-100 text-blue-900' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {u.name ? u.name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{u.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                              {u.role_label || u.role}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.is_active !== false
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {u.is_active !== false ? 'مفعل ✓' : 'معطل ✕'}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-slate-600 mt-0.5">
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        {/* كلمة المرور */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {visiblePasswords[u.id] ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-slate-400 hover:text-slate-600 mr-1 cursor-pointer"
                            title={visiblePasswords[u.id] ? 'إخفاء' : 'إظهار'}
                          >
                            {visiblePasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* زر تفعيل/تعطيل */}
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u.id)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                            u.is_active !== false
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                          title={u.is_active !== false ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                        >
                          {u.is_active !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>

                        {/* زر التعديل */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(u)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-colors cursor-pointer"
                          title="تعديل بيانات المستخدم وكلمة المرور"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* زر الحذف */}
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs transition-colors cursor-pointer"
                          title="حذف المستخدم وسحب صلاحية الدخول"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* نافذة الفحص السريع لخادم البريد SMTP والتحقق من بيانات الاعتماد */}
      <SmtpQuickTestModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        initialHost={formData.smtp_host}
        initialPort={formData.smtp_port}
        initialSecure={formData.smtp_secure}
        initialUser={formData.smtp_user || formData.admin_email}
        initialPass={formData.smtp_pass}
        adminEmail={formData.admin_email}
        onApplyCredentials={handleApplySmtpCredentials}
      />

      {/* نافذة منبثقة لإضافة أو تعديل مستخدم مصرح له بالدخول للنظام */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden text-right font-sans"
            dir="rtl"
          >
            <div className="p-5 bg-gradient-to-l from-blue-950 via-blue-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingUserId ? 'تعديل بيانات المستخدم وكلمة المرور' : 'إضافة مستخدم جديد مصرح له'}
                  </h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    منح صلاحية الدخول للنظام وتعيين كلمة المرور والدور
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5 text-xs">
              {userFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{userFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">الاسم الكامل / المسمى الوظيفي *</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="مثال: م.م. سارة علي حسن أو منسق الدورات"
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">البريد الإلكتروني المعتمد للدخول *</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="user@atu.edu.iq أو user@gmail.com"
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">كلمة المرور المحددة له *</label>
                  <button
                    type="button"
                    onClick={() => setUserPassword(Math.floor(100000 + Math.random() * 900000).toString())}
                    className="text-[10px] text-blue-700 hover:underline font-bold"
                  >
                    توليد رمز عشوائي
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showUserPasswordInput ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور التي سيدخل بها..."
                    required
                    className="w-full border border-slate-300 rounded-xl p-2.5 pl-10 bg-white font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPasswordInput(!showUserPasswordInput)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showUserPasswordInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">الدور والصلاحية *</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 font-medium"
                >
                  <option value="staff">مشرف أنشطة وإرسال تذكيرات (Staff)</option>
                  <option value="admin">مسؤول إداري بصلاحيات كاملة (Admin)</option>
                  <option value="editor">مدخل بيانات الأنشطة والمحاضرين (Data Entry)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={userIsActive}
                    onChange={(e) => setUserIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 cursor-pointer"
                  />
                  <span className="text-slate-800 font-semibold">حساب نشط ومصرح له بالدخول حالياً</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-950 to-blue-900 hover:from-blue-900 hover:to-blue-800 text-white font-bold transition-all shadow-md shadow-blue-950/15 cursor-pointer"
                >
                  {editingUserId ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
