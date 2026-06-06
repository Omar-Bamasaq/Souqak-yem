import nodemailer from "nodemailer";
import dns from "dns";

const ipv4Lookup = (hostname, options, callback) => {
  return dns.lookup(hostname, { family: 4 }, callback);
};

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

/**
 * Creates a standard transporter with DIRECT IPv4 IP to bypass DNS/IPv6 issues
 */
function createTransporter(account, port = 465) {
  const host = "smtp.gmail.com";
  const secure = port === 465;
  
  console.log(`[EMAIL SYSTEM] Creating transporter for: ${account.user} on port ${port}`);
  
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure, // true for 465, false for 587
    auth: {
      user: account.user,
      pass: account.pass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true,
    family: 4, // Force IPv4
    lookup: ipv4Lookup,
    tls: {
      rejectUnauthorized: false
    },
    debug: true,
    logger: true
  });

  console.log(`[TRANSPORTER CREATED] for ${account.user} on port ${port}`);
  return transporter;
}

/**
 * Verifies all configured email accounts on startup
 */
export async function verifyEmailAccounts() {
  const accounts = getEmailAccounts();
  console.log(`[EMAIL SYSTEM] Starting verification for ${accounts.length} accounts...`);
  
  for (const acc of accounts) {
    try {
      console.log(`[VERIFY START] Testing Port 465 for: ${acc.user}`);
      const transporter465 = createTransporter(acc, 465);
      await transporter465.verify();
      console.log(`[VERIFY SUCCESS] Account: ${acc.user} on Port 465`);
    } catch (err465) {
      console.warn(`[VERIFY FAILED] Port 465 failed for ${acc.user}: ${err465.message}`);
      
      try {
        console.log(`[VERIFY START] Testing Port 587 (STARTTLS) for: ${acc.user}`);
        const transporter587 = createTransporter(acc, 587);
        await transporter587.verify();
        console.log(`[VERIFY SUCCESS] Account: ${acc.user} on Port 587`);
      } catch (err587) {
        console.error(`[VERIFY FATAL] Both ports failed for ${acc.user}. 465: ${err465.message}, 587: ${err587.message}`);
      }
    }
  }
}

async function sendMailWithFallback(mailOptions, type = "OTP") {
  const emailAccounts = getEmailAccounts();
  let attempts = 0;
  let lastError = null;
  
  const maxAttempts = Math.min(emailAccounts.length, 4);

  if (emailAccounts.length === 0) {
    throw new Error("[EMAIL_CONFIG_ERROR] No valid email accounts found in .env");
  }

  while (attempts < maxAttempts) {
    const account = emailAccounts[attempts];
    if (!account) break;

    // Try Port 465 first, then 587
    for (const port of [465, 587]) {
      try {
        console.log(`[EMAIL ATTEMPT START] Sending ${type} via ${account.user} (Port ${port}, Account ${attempts + 1}/${maxAttempts})`);
        
        const transporter = createTransporter(account, port);

        const finalMailOptions = {
          ...mailOptions,
          from: `"سوقك" <${account.user}>`
        };

        console.log(`[EMAIL SENDMAIL START] Calling transporter.sendMail() on port ${port}...`);
        const info = await transporter.sendMail(finalMailOptions);
        console.log("[EMAIL SUCCESS] Mail sent successfully:", info);
        return { success: true, account: account.user };
      } catch (error) {
        console.error(`[EMAIL ERROR] Port ${port} failed for ${account.user}:`, error.message);
        lastError = error;
      }
    }
    
    attempts++;
  }

  console.error(`[EMAIL FATAL] All accounts and ports failed to send ${type} to ${mailOptions.to}`);
  throw new Error(lastError ? lastError.message : "All attempted accounts failed.");
}

export default sendMailWithFallback;

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
        <h2 style="color: #1d4ed8;">رمز التحقق</h2>
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
        <h2 style="color: #1d4ed8;">إعادة تعيين كلمة المرور</h2>
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
        <h2 style="color: #1d4ed8;">طلب شراء آمن جديد</h2>
        <p style="font-size: 16px; color: #333;">مرحباً <strong>${sellerName}</strong>،</p>
        <p style="font-size: 16px; color: #333;">لقد تلقيت طلب شراء آمن جديد لإعلانك:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #1d4ed8; text-align: right;">
          <div style="font-weight: bold; color: #1e40af; margin-bottom: 5px;">${adTitle}</div>
          <div style="font-size: 14px; color: #666;">رقم الطلب: #${orderId.toString().slice(-6)}</div>
          <div style="font-size: 14px; color: #666;">السعر المتفق عليه: ${price} ${currency}</div>
          <div style="font-size: 14px; color: #666;">التوصيل: ${deliveryText}</div>
          <div style="font-size: 14px; color: #666;">رسوم التوصيل: ${shippingFee} ${shippingCurrency}</div>
        </div>
        <p style="color: #666; font-size: 14px; margin-bottom: 25px;">يرجى التوجه إلى حسابك للموافقة على الطلب أو رفضه.</p>
        <a href="http://localhost:5173/profile/orders" style="background: #1d4ed8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">مراجعة الطلب</a>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 25px;">
        <p style="color: #999; font-size: 12px; margin-top: 10px;">تحياتنا،<br>فريق منصة سوقك</p>
      </div>
    `
  };

  return await sendMailWithFallback(mailOptions, "Safe Purchase Notification");
}

