import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Helper to resolve SMTP transporter from request body or environment variables
  const getTransporter = async (smtpConfig?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
  }) => {
    const host = smtpConfig?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = smtpConfig?.port || parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = smtpConfig?.secure !== undefined ? smtpConfig.secure : (port === 465);
    const user = smtpConfig?.user || process.env.SMTP_USER;
    const pass = smtpConfig?.pass || process.env.SMTP_PASS;

    if (user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      return { transporter, mode: 'smtp' as const, user, host };
    }

    // Fallback: Create an Ethereal test account so that real test emails can still be sent and inspected
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      return { transporter, mode: 'ethereal' as const, user: testAccount.user, host: 'smtp.ethereal.email' };
    } catch {
      return null;
    }
  };

  // 1. API: Verify SMTP connection
  // 1. API: Verify SMTP connection with detailed diagnostics and optional test email
  app.post('/api/verify-smtp', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { host, port, secure, user, pass, testRecipient } = req.body || {};

      const cleanUser = user ? String(user).trim() : '';
      // إزالة المسافات التي قد ينسخها المستخدم من كلمة مرور تطبيقات جوجل (4 مجموعات من 4 أحرف)
      const cleanPass = pass ? String(pass).replace(/\s+/g, '') : '';
      const activeHost = host ? String(host).trim() : 'smtp.gmail.com';
      const parsedPort = port ? parseInt(String(port), 10) : 465;
      const isSecure = secure !== undefined ? Boolean(secure) : (parsedPort === 465);

      if (!cleanUser || !cleanPass) {
        return res.status(400).json({
          success: false,
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور / كلمة مرور التطبيقات لخادم SMTP',
          advice: 'اسم المستخدم هو عادةً بريدك الجامعي (@atu.edu.iq أو @gmail.com)، وكلمة المرور هي «كلمة مرور التطبيقات (App Password)» المكونة من 16 حرفاً.',
        });
      }

      const transporter = nodemailer.createTransport({
        host: activeHost,
        port: parsedPort,
        secure: isSecure,
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // الخطوة 1: فحص مصافحة الاتصال والمصادقة
      await transporter.verify();
      const responseTimeMs = Date.now() - startTime;

      let sentTestEmail = false;
      let testMessageId: string | undefined;

      // الخطوة 2: إذا تم إدخال بريد مستلم للتجربة، إرسال رسالة فحص فعلية
      if (testRecipient && typeof testRecipient === 'string' && testRecipient.includes('@')) {
        const targetEmail = testRecipient.trim();
        const testInfo = await transporter.sendMail({
          from: `"فحص خادم البريد - كلية البوليتكنك" <${cleanUser}>`,
          to: targetEmail,
          subject: `✅ اختبار نجاح اتصال خادم البريد (SMTP) - ${new Date().toLocaleTimeString('ar-EG')}`,
          html: `
            <div dir="rtl" style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; color: #1e293b; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a8a; padding: 16px 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🎉 نجاح اختبار اتصال خادم البريد SMTP</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">كلية البوليتكنك - بابل | المساعد الرقمي لمركز التعليم المستمر</p>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                تم استلام هذه الرسالة بنجاح عبر خادم البريد المباشر (<strong>${activeHost}:${parsedPort}</strong>)، مما يؤكد صحة بيانات الاعتماد وجاهزية النظام لإرسال التذكيرات الرسمية والتقارير اليومية.
              </p>

              <div style="background: #ffffff; padding: 16px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 13px; margin-bottom: 16px;">
                <p style="margin: 4px 0;"><strong>📧 بريد المرسل (SMTP User):</strong> <span style="font-family: monospace;">${cleanUser}</span></p>
                <p style="margin: 4px 0;"><strong>🎯 بريد المستلم التجريبي:</strong> <span style="font-family: monospace;">${targetEmail}</span></p>
                <p style="margin: 4px 0;"><strong>⚡ زمن الاستجابة:</strong> ${responseTimeMs} ميلي ثانية</p>
                <p style="margin: 4px 0;"><strong>🔒 نمط التشفير:</strong> ${isSecure ? 'SSL/TLS (آمن ومشفّر)' : 'STARTTLS'}</p>
                <p style="margin: 4px 0;"><strong>🕒 وقت الإرسال:</strong> ${new Date().toLocaleString('ar-EG')}</p>
              </div>

              <p style="font-size: 12px; color: #64748b; margin: 0; border-top: 1px solid #e2e8f0; pt: 12px;">
                هذه الرسالة تم توليدها آلياً عبر نافذة الإعدادات السريعة لفحص خادم البريد.
              </p>
            </div>
          `,
          text: `نجاح اختبار خادم البريد SMTP من ${cleanUser} إلى ${targetEmail}. وقت الإرسال: ${new Date().toLocaleString('ar-EG')}`,
        });
        sentTestEmail = true;
        testMessageId = testInfo.messageId;
      }

      return res.json({
        success: true,
        message: sentTestEmail 
          ? `تم الاتصال بنجاح بخادم البريد وإرسال رسالة تجريبية فعلية إلى: ${testRecipient}`
          : 'تم الاتصال بخادم البريد والتحقق بنجاح من صحة بيانات الاعتماد.',
        details: {
          host: activeHost,
          port: parsedPort,
          secure: isSecure,
          user: cleanUser,
          responseTimeMs,
          sentTestEmail,
          testMessageId,
        },
      });
    } catch (err: any) {
      console.error('SMTP Verify Error:', err);
      const errorMsg = err.message || '';
      const errCode = String(err.code || err.responseCode || '');
      let advice = 'يرجى مراجعة بيانات الخادم والمنفذ وكلمة المرور.';

      if (
        errCode === 'EAUTH' || 
        errorMsg.includes('535') || 
        errorMsg.toLowerCase().includes('bad credentials') || 
        errorMsg.toLowerCase().includes('username and password not accepted')
      ) {
        advice = 'خطأ في المصادقة (535 Bad Credentials): حساب Google/Gmail يرفض كلمة المرور العادية لأسباب أمنية. لحل المشكلة: افتح «إدارة حساب Google» ⬅️ «الأمان» ⬅️ فعّل «التحقق بخطوتين» ⬅️ أنشئ «كلمة مرور تطبيقات (App Password)» مكونة من 16 حرفاً واستخدمها بدلاً من كلمة المرور العادية.';
      } else if (
        errCode === 'ETIMEDOUT' || 
        errCode === 'ENOTFOUND' || 
        errorMsg.includes('getaddrinfo')
      ) {
        advice = 'تعذر الوصول إلى خادم البريد (Host). تأكد من صحة اسم الخادم (مثل smtp.gmail.com) ومن اتصال الإنترنت.';
      } else if (errCode === 'ECONNREFUSED') {
        advice = `تم رفض الاتصال على المنفذ المحدد. جرب استخدام المنفذ 465 مع تفعيل خيار SSL/TLS، أو المنفذ 587 مع STARTTLS.`;
      } else if (errorMsg.includes('greeting timeout')) {
        advice = 'انتهت مهلة انتظار تحية الخادم. تحقق من تطابق المنفذ (465 يتطلب SSL، بينما 587 لا يتطلب SSL مباشرة).';
      }

      return res.status(400).json({
        success: false,
        error: errorMsg || 'فشل الاتصال بخادم SMTP. يرجى التأكد من صحة بيانات الخادم وكلمة مرور التطبيقات.',
        errorCode: errCode,
        advice,
      });
    }
  });

  // 2. API: Send test email
  app.post('/api/send-test-email', async (req: Request, res: Response) => {
    try {
      const { to, subject, html, text, smtpConfig, senderName, senderEmail, replyTo } = req.body || {};

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'يرجى إدخال عنوان البريد الإلكتروني للمستلم.',
        });
      }

      const mailer = await getTransporter(smtpConfig);

      if (!mailer) {
        return res.status(500).json({
          success: false,
          error: 'تعذر إنشاء عميل البريد الإلكتروني. يرجى ضبط إعدادات خادم SMTP في صفحة الإعدادات.',
        });
      }

      const activeSenderEmail = senderEmail || replyTo || mailer.user;
      const fromAddress = senderName 
        ? `"${senderName}" <${mailer.mode === 'smtp' ? activeSenderEmail : mailer.user}>` 
        : (mailer.mode === 'smtp' ? activeSenderEmail : mailer.user);

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to,
        replyTo: activeSenderEmail,
        subject: subject || 'بريد تجريبي لاختبار قالب التذكير',
        html: html || '<p>هذه رسالة بريد تجريبية من المساعد الرقمي لمركز التعليم المستمر.</p>',
        text: text || 'هذه رسالة بريد تجريبية من المساعد الرقمي لمركز التعليم المستمر.',
      };

      const info = await mailer.transporter.sendMail(mailOptions);
      const previewUrl = mailer.mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : undefined;

      return res.json({
        success: true,
        messageId: info.messageId,
        mode: mailer.mode,
        previewUrl,
        message: mailer.mode === 'smtp'
          ? `تم إرسال البريد الإلكتروني الفعلي بنجاح من (${activeSenderEmail}) إلى: ${to}`
          : `تم توليد الرسالة التجريبية بنجاح باسم المرسل (${activeSenderEmail}) في بيئة الاختبار (Ethereal). لوصول البريد إلى صندوق وارد Gmail الفعلي، استخدم زر «📧 فتح فوري في Gmail الجامعي» أو أدخل كلمة مرور التطبيقات في الإعدادات.`,
      });
    } catch (err: any) {
      console.error('Send Test Email Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'حدث خطأ أثناء محاولة إرسال البريد الإلكتروني.',
      });
    }
  });

  // 3. API: Send live reminder email
  app.post('/api/send-email', async (req: Request, res: Response) => {
    try {
      const { to, subject, html, text, smtpConfig, senderName, senderEmail, replyTo } = req.body || {};

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'عنوان البريد الإلكتروني مطلوب.',
        });
      }

      const mailer = await getTransporter(smtpConfig);

      if (!mailer) {
        return res.status(500).json({
          success: false,
          error: 'خادم SMTP غير متوفر أو غير مهيأ.',
        });
      }

      const activeSenderEmail = senderEmail || replyTo || mailer.user;
      const fromAddress = senderName 
        ? `"${senderName}" <${mailer.mode === 'smtp' ? activeSenderEmail : mailer.user}>` 
        : (mailer.mode === 'smtp' ? activeSenderEmail : mailer.user);

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to,
        replyTo: activeSenderEmail,
        subject,
        html,
        text,
      };

      const info = await mailer.transporter.sendMail(mailOptions);
      const previewUrl = mailer.mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : undefined;

      return res.json({
        success: true,
        messageId: info.messageId,
        mode: mailer.mode,
        previewUrl,
        message: mailer.mode === 'smtp'
          ? `تم إرسال البريد الإلكتروني الفعلي بنجاح من (${activeSenderEmail}) إلى: ${to}`
          : `تم توليد الرسالة باسم المرسل (${activeSenderEmail}) في بيئة الاختبار (Ethereal). لوصول البريد إلى البريد الجامعي الفعلي للمحاضرين، يرجى إدخال كلمة مرور التطبيقات في تبويب الإعدادات أو استخدام زر الفتح الفوري في Gmail.`,
      });
    } catch (err: any) {
      console.error('Send Email Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'فشل إرسال البريد الإلكتروني.',
      });
    }
  });

  // 4. API: Check service health and configured features
  app.get('/api/health', (req: Request, res: Response) => {
    const hasEnvSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      status: 'ok',
      hasEnvSmtp,
      smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : null,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      timestamp: new Date().toISOString(),
    });
  });

  // Setup Vite in Dev or Static files in Prod
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (dev: ${!isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
