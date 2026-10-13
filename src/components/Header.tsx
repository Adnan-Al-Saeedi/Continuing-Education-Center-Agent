import React, { useState, useEffect, useRef } from 'react';
import { Clock, Send, ShieldCheck, LogOut, Bell, CheckCheck, Trash2, CheckCircle2, AlertCircle, Info, AlertTriangle, Mail, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Settings, AppNotification } from '../types';
import { useAuth } from '../context/AuthContext';
import { getNotificationPermissionStatus, requestNotificationPermission, sendBrowserNotification, getGmailInboxUrl } from '../lib/emailService';

interface HeaderProps {
  settings: Settings;
  onSendNow: () => void;
  isSending: boolean;
  notifications?: AppNotification[];
  onClearNotifications?: () => void;
  onMarkAllNotificationsRead?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  settings, 
  onSendNow, 
  isSending,
  notifications = [],
  onClearNotifications,
  onMarkAllNotificationsRead,
}) => {
  const { admin, logout } = useAuth();
  const [baghdadTime, setBaghdadTime] = useState<string>('');
  const [timeUntilCron, setTimeUntilCron] = useState<string>('');
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(getNotificationPermissionStatus());
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // توقيت بغداد (UTC+3)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const bgDate = new Date(utc + 3 * 3600000);

      const hours = bgDate.getHours().toString().padStart(2, '0');
      const minutes = bgDate.getMinutes().toString().padStart(2, '0');
      const seconds = bgDate.getSeconds().toString().padStart(2, '0');
      setBaghdadTime(`${hours}:${minutes}:${seconds}`);

      // حساب الوقت المتبقي حتى الساعة 08:00 صباحاً بتوقيت بغداد
      const targetCron = new Date(bgDate);
      if (bgDate.getHours() >= 8) {
        targetCron.setDate(targetCron.getDate() + 1);
      }
      targetCron.setHours(8, 0, 0, 0);

      const diffMs = targetCron.getTime() - bgDate.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilCron(`${diffHrs} س و ${diffMins} د`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-2xl backdrop-saturate-180 border-b border-slate-200/70 sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* الشعار والعناوين الأكاديمية */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-950/15 overflow-hidden border border-blue-800/40">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="شعار الكلية" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="tracking-tighter text-blue-100 font-black">CE</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200/60">
                  {settings.university_name}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {settings.college_name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  {settings.center_name}
                </h1>
                {settings.admin_email && (
                  <a
                    href={getGmailInboxUrl(settings.admin_email)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 text-[11px] font-mono font-bold transition-colors shadow-2xs"
                    title="بريد مرسل الإشعارات المعتمد واستلام التقرير اليومي (انقر لفتح البريد المرتبط في Gmail)"
                  >
                    <Mail className="w-3 h-3 text-blue-900" />
                    <span>مرسل الإشعارات: {settings.admin_email}</span>
                    <LinkIcon className="w-2.5 h-2.5 text-emerald-600" />
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* التوقيت ومؤشر حالة النظام وأزرار الإجراءات */}
          <div className="flex items-center gap-3">
            
            {/* بطاقة توقيت بغداد وموعد الإرسال اليومي */}
            <div className="hidden md:flex items-center gap-3 bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>بغداد:</span>
                <span className="font-mono font-bold text-slate-900">{baghdadTime}</span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="text-slate-600">
                <span>الإرسال القادم (08:00 ص):</span>{' '}
                <span className="font-semibold text-blue-900">{timeUntilCron}</span>
              </div>
            </div>

            {/* زر إرسال الآن - زر اتخاذ الإجراء CTA الذهبي/البرتقالي الملكي */}
            <button
              id="send-now-header-btn"
              onClick={onSendNow}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-slate-950 text-sm font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer border border-amber-400/40"
              title="فحص الأنشطة المستحقة وإرسال التذكيرات فوراً"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'جارٍ الإرسال...' : 'إرسال الآن'}</span>
            </button>

            {/* مركز الإشعارات (Notification Center) */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotificationsMenu(!showNotificationsMenu);
                  if (!showNotificationsMenu && unreadCount > 0 && onMarkAllNotificationsRead) {
                    onMarkAllNotificationsRead();
                  }
                }}
                className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                  showNotificationsMenu
                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                }`}
                title="مركز الإشعارات والتنبيهات"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-xs animate-pulse">
                    {unreadCount > 9 ? '+9' : unreadCount}
                  </span>
                )}
              </button>

              {/* القائمة المنسدلة للإشعارات */}
              {showNotificationsMenu && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold">مركز الإشعارات والتنبيهات</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {onMarkAllNotificationsRead && unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={onMarkAllNotificationsRead}
                          className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                          title="تحديد الكل كمقروء"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>قراءة الكل</span>
                        </button>
                      )}
                      {onClearNotifications && notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearNotifications}
                          className="text-[11px] text-rose-300 hover:text-rose-100 flex items-center gap-1 cursor-pointer"
                          title="مسح كافة الإشعارات"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>مسح</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* شريط حالة إشعارات المتصفح */}
                  <div className="p-2.5 bg-slate-50 border-b border-slate-100 text-[11px] flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${notifPermission === 'granted' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      <span>إشعارات سطح المكتب: {notifPermission === 'granted' ? 'مفعلة' : 'معطلة'}</span>
                    </span>
                    {notifPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await requestNotificationPermission();
                          setNotifPermission(getNotificationPermissionStatus());
                          if (res) {
                            sendBrowserNotification('تم تفعيل إشعارات سطح المكتب 🔔', {
                              body: 'ستصلك التنبيهات فورياً عند إرسال التذكيرات.',
                            });
                          }
                        }}
                        className="text-blue-700 font-bold hover:underline cursor-pointer"
                      >
                        تفعيل الآن 🔔
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          sendBrowserNotification('إشعار تجريبي 🔔', {
                            body: 'نظام الإشعارات يعمل ويصلك بالشكل الصحيح تماماً!',
                          });
                        }}
                        className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        تجربة
                      </button>
                    )}
                  </div>

                  {/* شريط بريد مرسل الإشعارات المرتبط */}
                  {settings.admin_email && (
                    <div className="p-2.5 bg-blue-50/80 border-b border-blue-100 text-[11px] flex items-center justify-between gap-2">
                      <span className="text-blue-950 font-semibold flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>مرسل الإشعارات:</span>
                        <a
                          href={`mailto:${settings.admin_email}`}
                          className="font-mono font-bold text-blue-800 underline truncate"
                        >
                          {settings.admin_email}
                        </a>
                      </span>
                      <a
                        href={getGmailInboxUrl(settings.admin_email)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold shrink-0 transition-colors"
                      >
                        <span>Gmail</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  {/* قائمة الإشعارات */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        لا توجد إشعارات جديدة حالياً.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 text-xs transition-colors ${
                            notif.read ? 'bg-white hover:bg-slate-50/70' : 'bg-blue-50/40 hover:bg-blue-50/70'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0">
                              {notif.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              {notif.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                              {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                              {notif.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span className="truncate">{notif.title}</span>
                                <span className="text-[10px] text-slate-400 font-normal shrink-0 mr-1">
                                  {new Date(notif.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* معلومات المسؤول وتسجيل الخروج */}
            {admin && (
              <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <ShieldCheck className={`w-3 h-3 inline ${admin.isSuperAdmin ? 'text-amber-500' : 'text-sky-600'}`} />
                    <span>{admin.role_label || (admin.isSuperAdmin ? 'مسؤول النظام الرئيسي' : 'مستخدم مصرح له')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[160px]" title={admin.email}>
                    {admin.name ? `${admin.name} - ${admin.email}` : admin.email}
                  </div>
                </div>
                <button
                  id="logout-header-btn"
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
