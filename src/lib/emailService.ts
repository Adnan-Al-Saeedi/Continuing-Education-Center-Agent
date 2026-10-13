import { Settings } from '../types';

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  mode?: 'smtp' | 'ethereal' | 'client_gmail' | 'client_mailto';
  previewUrl?: string;
  error?: string;
}

/**
 * دالة لتوليد رابط مباشر لفتح رسالة البريد في Google Workspace / Gmail Web معبأة بالكامل
 * مع ربط الحساب المرسل مباشرة ببريد استلام التقرير اليومي (Admin Email)
 */
export function getGmailComposeUrl(to: string, subject: string, plainBody: string, senderEmail?: string): string {
  const encTo = encodeURIComponent(to);
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(plainBody);
  const authUser = encodeURIComponent((senderEmail || 'adn.ak21@atu.edu.iq').trim());
  return `https://mail.google.com/mail/?authuser=${authUser}&view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}`;
}

/**
 * دالة لفتح صندوق بريد مرسل الإشعارات (Admin Email) مباشرة في Google Workspace / Gmail
 */
export function getGmailInboxUrl(senderEmail?: string): string {
  const authUser = encodeURIComponent((senderEmail || 'adn.ak21@atu.edu.iq').trim());
  return `https://mail.google.com/mail/?authuser=${authUser}`;
}

/**
 * دالة لتوليد رابط mailto القياسي لتطبيقات البريد (Outlook, Apple Mail, إلخ)
 */
export function getMailtoUrl(to: string, subject: string, plainBody: string): string {
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(plainBody);
  return `mailto:${to}?subject=${encSubject}&body=${encBody}`;
}

/**
 * استخراج نص عادي نظيف من شفرة HTML
 */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const temp = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return temp;
}

export interface SmtpVerifyResult {
  success: boolean;
  message: string;
  error?: string;
  errorCode?: string;
  advice?: string;
  details?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    responseTimeMs?: number;
    sentTestEmail?: boolean;
    testMessageId?: string;
  };
}

/**
 * فحص الاتصال بخادم البريد الإلكتروني SMTP مع تشخيص الأخطاء وإمكانية إرسال بريد تجريبي فوري
 */
export async function verifySmtp(
  config: SmtpConfig & { testRecipient?: string }
): Promise<SmtpVerifyResult> {
  try {
    const res = await fetch('/api/verify-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { 
        success: true, 
        message: data.message || 'تم الاتصال بخادم SMTP بنجاح!',
        details: data.details,
      };
    }
    return { 
      success: false, 
      message: data.error || 'فشل الاتصال بخادم SMTP.',
      error: data.error,
      errorCode: data.errorCode,
      advice: data.advice,
      details: data.details,
    };
  } catch (err: any) {
    return { 
      success: false, 
      message: 'تعذر الوصول إلى سيرفر الواجهة الخلفية للفحص. يمكنك استخدام الإرسال المباشر عبر Gmail أو التأكد من تشغيل السيرفر.',
      error: err.message,
      advice: 'تأكد من تشغيل خادم التطبيق وتوفر اتصال بالشبكة.',
    };
  }
}

/**
 * إرسال بريد تجريبي
 */
export async function sendTestEmail(params: {
  to: string;
  subject: string;
  html: string;
  settings: Settings;
}): Promise<SendEmailResult> {
  const { to, subject, html, settings } = params;
  const plainText = stripHtmlToText(html);

  const officialSenderEmail = settings.admin_email || settings.smtp_user || 'adn.ak21@atu.edu.iq';

  const smtpConfig: SmtpConfig = {
    host: settings.smtp_host || 'smtp.gmail.com',
    port: settings.smtp_port || 465,
    secure: settings.smtp_secure !== undefined ? settings.smtp_secure : true,
    user: officialSenderEmail,
    pass: settings.smtp_pass,
  };

  try {
    const res = await fetch('/api/send-test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        html,
        text: plainText,
        smtpConfig: smtpConfig.user && smtpConfig.pass ? smtpConfig : undefined,
        senderName: settings.sender_name,
        senderEmail: officialSenderEmail,
        replyTo: officialSenderEmail,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        mode: data.mode,
        message: data.message || `تم إرسال البريد التجريبي بنجاح من (${officialSenderEmail}) إلى ${to}`,
        previewUrl: data.previewUrl,
      };
    } else {
      return {
        success: false,
        message: data.error || 'فشل إرسال البريد التجريبي عبر السيرفر.',
        error: data.error,
      };
    }
  } catch (err: any) {
    // في حال العمل على GitHub Pages كواجهة ثابتة أو تعذر الاتصال بالسيرفر المحلي
    return {
      success: false,
      message: 'خادم الإرسال السحابي المباشر غير متصل، يمكنك استخدام خيار الإرسال الفوري عبر بريد Gmail الجامعي أو تطبيق البريد.',
      error: err.message,
    };
  }
}

/**
 * إرسال بريد تذكير رسمي فعلي
 */
export async function sendActualEmail(params: {
  to: string;
  subject: string;
  html: string;
  settings: Settings;
}): Promise<SendEmailResult> {
  const { to, subject, html, settings } = params;
  const plainText = stripHtmlToText(html);
  const officialSenderEmail = settings.admin_email || settings.smtp_user || 'adn.ak21@atu.edu.iq';

  const smtpConfig: SmtpConfig = {
    host: settings.smtp_host || 'smtp.gmail.com',
    port: settings.smtp_port || 465,
    secure: settings.smtp_secure !== undefined ? settings.smtp_secure : true,
    user: officialSenderEmail,
    pass: settings.smtp_pass,
  };

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        html,
        text: plainText,
        smtpConfig: smtpConfig.user && smtpConfig.pass ? smtpConfig : undefined,
        senderName: settings.sender_name,
        senderEmail: officialSenderEmail,
        replyTo: officialSenderEmail,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        mode: data.mode,
        message: `تم إرسال البريد بنجاح إلى ${to}`,
        previewUrl: data.previewUrl,
      };
    } else {
      return {
        success: false,
        message: data.error || `تعذر إرسال البريد إلى ${to}`,
        error: data.error,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `فشل الاتصال بخدمة البريد: ${err.message}`,
      error: err.message,
    };
  }
}

/**
 * إطلاق إشعار نظام حقيقي لسطح المكتب والمتصفح (Web Notification API)
 */
export async function sendBrowserNotification(title: string, options?: {
  body?: string;
  icon?: string;
  tag?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      new Notification(title, {
        body: options?.body || '',
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag,
        dir: 'rtl',
        lang: 'ar',
      });
      return true;
    }
  } catch (err) {
    console.warn('Browser notification error:', err);
  }

  return false;
}

/**
 * فحص هل إشعارات المتصفح مدعومة ومفعلة
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * طلب إذن إشعارات المتصفح
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}
