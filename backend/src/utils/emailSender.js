import nodemailer from "nodemailer";

let currentEmailIndex = 0;

function getEmailAccounts() {
  // حسابات المستخدمين حصراً (non.reply.yourplatform)
  return [
    { user: process.env.EMAIL_USER_1?.trim(), pass: process.env.EMAIL_PASS_1?.trim() },
    { user: process.env.EMAIL_USER_2?.trim(), pass: process.env.EMAIL_PASS_2?.trim() },
    { user: process.env.EMAIL_USER_3?.trim(), pass: process.env.EMAIL_PASS_3?.trim() },
    { user: process.env.EMAIL_USER_4?.trim(), pass: process.env.EMAIL_PASS_4?.trim() },
    { user: process.env.EMAIL_USER_5?.trim(), pass: process.env.EMAIL_PASS_5?.trim() },
    { user: process.env.EMAIL_USER_6?.trim(), pass: process.env.EMAIL_PASS_6?.trim() },
    { user: process.env.EMAIL_USER_7?.trim(), pass: process.env.EMAIL_PASS_7?.trim() },
    { user: process.env.EMAIL_USER_8?.trim(), pass: process.env.EMAIL_PASS_8?.trim() }
  ].filter(acc => acc.user && acc.pass && acc.pass.trim() !== "");
}

function getNextEmailAccount(accounts) {
  if (accounts.length === 0) return null;
  const account = accounts[currentEmailIndex % accounts.length];
  currentEmailIndex = (currentEmailIndex + 1) % accounts.length;
  return account;
}

async function sendMailWithFallback(mailOptions, type = "OTP") {
  const emailAccounts = getEmailAccounts();
  let attempts = 0;
  let lastError = null;
  
  const maxAttempts = Math.min(emailAccounts.length, 3);

  if (emailAccounts.length === 0) {
    throw new Error("[EMAIL_CONFIG_ERROR] No valid email accounts found in .env");
  }

  while (attempts < maxAttempts) {
    const account = getNextEmailAccount(emailAccounts);
    if (!account) break;

    try {
      // Use standard Gmail SMTP settings with fallback options
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // Use SSL/TLS
        auth: {
          user: account.user,
          pass: account.pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          // Do not fail on invalid certs (common in some hosting environments)
          rejectUnauthorized: false
        }
      });

      const finalMailOptions = {
        ...mailOptions,
        from: `"سوقك" <${account.user}>`
      };

      console.log(`[EMAIL ATTEMPT] Trying to send via: ${account.user} (Attempt ${attempts + 1}/${maxAttempts})`);
      await transporter.sendMail(finalMailOptions);
      console.log(`[EMAIL SUCCESS] ${type} sent successfully using:`, account.user);
      return { success: true, account: account.user };
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send using ${account.user}:`, error.message);
      lastError = error;
      attempts++;
      
      // If first attempt fails, try port 587 for the same account before moving to next
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        try {
          console.log(`[EMAIL RETRY] Trying port 587 for: ${account.user}`);
          const transporter587 = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // Use STARTTLS
            auth: {
              user: account.user,
              pass: account.pass
            },
            connectionTimeout: 10000,
            tls: { rejectUnauthorized: false }
          });
          await transporter587.sendMail({ ...mailOptions, from: `"سوقك" <${account.user}>` });
          console.log(`[EMAIL SUCCESS] Sent via port 587: ${account.user}`);
          return { success: true, account: account.user };
        } catch (err2) {
          console.error(`[EMAIL ERROR] Port 587 also failed for ${account.user}:`, err2.message);
        }
      }
    }
  }

  const errorMessage = lastError ? lastError.message : "All attempted email accounts failed.";
  throw new Error(`[EMAIL_ALL_FAILED] ${errorMessage}`);
}

export async function sendVerificationEmail(to, code) {
  const mailOptions = {
    to,
    replyTo: "non.reply.yourplatform@gmail.com",
    subject: "رمز التحقق لتسجيل الدخول في منصة سوقك",
    text: `
مرحباً،

رمز التحقق الخاص بك في منصة سوقك هو:

${code}

هذا الرمز صالح لمدة 10 دقائق فقط.

إذا لم تقم بإنشاء حساب في منصة سوقك، يمكنك تجاهل هذه الرسالة.

تحياتنا،
فريق منصة سوقك
    `,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
        <h2 style="color: #2563eb;">رمز التحقق</h2>
        <p style="font-size: 16px; color: #333;">رمز التحقق الخاص بك هو:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #1e40af;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">صالح لمدة 10 دقائق فقط</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">إذا لم تقم بإنشاء حساب في منصة سوقك، يمكنك تجاهل هذه الرسالة.</p>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">تحياتنا،<br>فريق منصة سوقك</p>
      </div>
    `
  };

  return await sendMailWithFallback(mailOptions, "OTP");
}

export async function sendPasswordResetEmail(to, code) {
  const mailOptions = {
    to,
    replyTo: "non.reply.yourplatform@gmail.com",
    subject: "رمز إعادة تعيين كلمة المرور - سوقك",
    text: `
مرحباً،

لقد طلبت إعادة تعيين كلمة المرور الخاصة بك في منصة سوقك. رمز التحقق هو:

${code}

هذا الرمز صالح لمدة 10 دقائق فقط.

إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.

تحياتنا،
فريق منصة سوقك
    `,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
        <h2 style="color: #2563eb;">إعادة تعيين كلمة المرور</h2>
        <p style="font-size: 16px; color: #333;">لقد طلبت إعادة تعيين كلمة المرور الخاصة بك. رمز التحقق هو:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #1e40af;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">صالح لمدة 10 دقائق فقط</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">تحياتنا،<br>فريق منصة سوقك</p>
      </div>
    `
  };

  return await sendMailWithFallback(mailOptions, "Reset OTP");
}

export async function sendSafePurchaseNotification(to, sellerName, adTitle, orderId, price, currency, shippingFee, shippingCurrency, deliveryText) {
  const mailOptions = {
    to,
    replyTo: "non.reply.yourplatform@gmail.com",
    subject: "طلب شراء آمن جديد - سوقك",
    text: `
مرحباً ${sellerName}،

لديك طلب شراء آمن جديد على إعلانك: "${adTitle}".

تفاصيل الطلب:
- رقم الطلب: ${orderId.toString().slice(-6)}
- السعر: ${price} ${currency}
- التوصيل: ${deliveryText}
- رسوم التوصيل: ${shippingFee} ${shippingCurrency}

يرجى مراجعة الطلب والموافقة عليه من خلال لوحة التحكم الخاصة بك.

تحياتنا،
فريق منصة سوقك
    `,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
        <h2 style="color: #2563eb;">طلب شراء آمن جديد</h2>
        <p style="font-size: 16px; color: #333;">مرحباً <strong>${sellerName}</strong>،</p>
        <p style="font-size: 16px; color: #333;">لقد تلقيت طلب شراء آمن جديد لإعلانك:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #2563eb; text-align: right;">
          <div style="font-weight: bold; color: #1e40af; margin-bottom: 5px;">${adTitle}</div>
          <div style="font-size: 14px; color: #666;">رقم الطلب: #${orderId.toString().slice(-6)}</div>
          <div style="font-size: 14px; color: #666;">السعر المتفق عليه: ${price} ${currency}</div>
          <div style="font-size: 14px; color: #666;">التوصيل: ${deliveryText}</div>
          <div style="font-size: 14px; color: #666;">رسوم التوصيل: ${shippingFee} ${shippingCurrency}</div>
        </div>
        <p style="color: #666; font-size: 14px; margin-bottom: 25px;">يرجى التوجه إلى حسابك للموافقة على الطلب أو رفضه.</p>
        <a href="http://localhost:5173/profile/orders" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">مراجعة الطلب</a>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 25px;">
        <p style="color: #999; font-size: 12px; margin-top: 10px;">تحياتنا،<br>فريق منصة سوقك</p>
      </div>
    `
  };

  return await sendMailWithFallback(mailOptions, "Safe Purchase Notification");
}

