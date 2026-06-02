import nodemailer from "nodemailer";

let currentEmailIndex = 0;

function getEmailAccounts() {
  // حسابات المستخدمين حصراً (non.reply.yourplatform)
  return [
    {
      user: process.env.EMAIL_USER_1?.trim(),
      pass: process.env.EMAIL_PASS_1?.trim()
    },
    {
      user: process.env.EMAIL_USER_2?.trim(),
      pass: process.env.EMAIL_PASS_2?.trim()
    },
    {
      user: process.env.EMAIL_USER_3?.trim(),
      pass: process.env.EMAIL_PASS_3?.trim()
    },
    {
      user: process.env.EMAIL_USER_4?.trim(),
      pass: process.env.EMAIL_PASS_4?.trim()
    },
    {
      user: process.env.EMAIL_USER_5?.trim(),
      pass: process.env.EMAIL_PASS_5?.trim()
    },
    {
      user: process.env.EMAIL_USER_6?.trim(),
      pass: process.env.EMAIL_PASS_6?.trim()
    },
    {
      user: process.env.EMAIL_USER_7?.trim(),
      pass: process.env.EMAIL_PASS_7?.trim()
    },
    {
      user: process.env.EMAIL_USER_8?.trim(),
      pass: process.env.EMAIL_PASS_8?.trim()
    }
  ].filter(acc => acc.user && acc.pass && acc.pass.trim() !== "");
}

function getNextEmailAccount(accounts) {
  if (accounts.length === 0) return null;
  const account = accounts[currentEmailIndex % accounts.length];
  currentEmailIndex = (currentEmailIndex + 1) % accounts.length;
  return account;
}

/**
 * دالة إرسال بريد إلكتروني للإدارة
 * تستخدم حساب my.platform.notifications@gmail.com حصراً
 */
export const sendAdminEmail = async (options) => {
  const adminSender = {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASS?.trim()
  };

  if (!adminSender.user || !adminSender.pass) {
    console.error("[ADMIN EMAIL ERROR] No valid admin sender account found.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: adminSender.user,
        pass: adminSender.pass,
      },
      // Force IPv4
      family: 4
    });

    const mailOptions = {
      from: `"تنبيهات سوقك" <${adminSender.user}>`,
      to: process.env.ADMIN_EMAIL,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[ADMIN EMAIL SUCCESS] Sent to Admin via: ${adminSender.user}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[ADMIN EMAIL ERROR] Failed to send to Admin via ${adminSender.user}: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return false;
  }
};

/**
 * دالة إرسال بريد إلكتروني للمستخدمين
 * تستخدم الحسابات المتناوبة (non.reply.yourplatform)
 */
export const sendEmail = async (options) => {
  const emailAccounts = getEmailAccounts();
  let attempts = 0;

  if (emailAccounts.length === 0) {
    console.error("[EMAIL ERROR] No valid email accounts found.");
    return false;
  }

  while (attempts < emailAccounts.length) {
    const account = getNextEmailAccount(emailAccounts);
    if (!account) break;

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: account.user,
          pass: account.pass,
        },
        // Force IPv4
        family: 4
      });

      const mailOptions = {
        from: `"سوقك" <${account.user}>`,
        to: options.to || process.env.ADMIN_EMAIL,
        subject: options.subject,
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL SUCCESS] Sent to ${mailOptions.to} via: ${account.user}. MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send to ${options.to} via ${account.user}: ${error.message}`);
      if (error.stack) console.error(error.stack);
      attempts++;
    }
  }

  console.error("[EMAIL ERROR] All email accounts failed.");
  return false;
};
