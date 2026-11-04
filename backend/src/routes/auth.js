import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import OtpCode from "../models/OtpCode.js";
import auth, { sendAuthResponse } from "../middleware/auth.js";
import { uploadIdDoc, uploadAvatar } from "../middleware/upload.js";
import { requireRole } from "../middleware/roles.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/emailSender.js";
import { normalizePhone, isValidPhoneNumber, isValidPassword, generateTemporaryPassword, buildPasswordResetRequestMessage, phoneNumberQuery } from "../utils/securityRules.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import PhoneVerificationRequest from "../models/PhoneVerificationRequest.js";
import { createAdminNotification } from "../services/notificationService.js";
import { isPushConfigured } from "../services/pushService.js";
import Order from "../models/Order.js";
import Dispute from "../models/Dispute.js";
import Withdrawal from "../models/Withdrawal.js";
import Wallet from "../models/Wallet.js";
import Ad from "../models/Ad.js";
import ReferralEngine from "../engines/ReferralEngine.js";
import {
  signAccessToken,
  verifyRefreshToken,
  JWT_ALGORITHM,
  inspectJwtClaimsOnly,
} from "../config/jwt.js";
import {
  hasReachedPasswordResetOtpAttemptLimit,
  isPasswordResetOtpLocked,
  recordInvalidPasswordResetOtpAttempt
} from "../services/passwordResetOtp.js";

const router = Router();
const phoneRegistrationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});
const phoneLoginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});
const accountRecoveryLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

function canUseEmailAccountRecovery(user) {
  return ["admin", "supervisor"].includes(user.role) || Boolean(user.managedAccount?.createdByAdmin);
}

/**
 * @swagger
 * /api/auth/register-email:
 *   post:
 *     summary: Deprecated email registration endpoint
 *     deprecated: true
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       410:
 *         description: Registration is available by phone only
 *       400:
 *         description: Missing fields or user already exists
 */
router.post("/register-email", (_req, res) => {
  return res.status(410).json({ error: "التسجيل متاح باستخدام رقم الهاتف فقط." });
}, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزًا دون مسافات أو حروف عربية." });
    }
    
    // Validate username uniqueness and format
    const nameValidation = await validateUsername(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.error });
    }

    const inputEmail = String(email).trim().toLowerCase();
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputEmail)) {
      return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة." });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: inputEmail });
    if (existingUser) {
      return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل مسبقًا، يمكنك تسجيل الدخول." });
    }

    // Rate limiting: max 3 codes per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const codeCount = await OtpCode.countDocuments({
      email: inputEmail,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (codeCount >= 3) {
      return res.status(429).json({ error: "لقد تجاوزت الحد المسموح به من الطلبات. حاول مرة أخرى بعد 5 دقائق." });
    }

    // Hash registration password temporarily
    const hashPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for code
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes for session

    // Store registration data and hashed code in OtpCode record
    const hashedCode = await bcrypt.hash(code, 10);
    
    // Clear old registration attempts for this email
    await OtpCode.deleteMany({ email: inputEmail });

    await OtpCode.create({
      name,
      email: inputEmail,
      password: hashPassword,
      code: hashedCode,
      codeExpiresAt,
      expiresAt
    });

    logSecurityEvent("Registration OTP requested", req, { email: inputEmail });

    // NON-BLOCKING BACKGROUND EMAIL SENDING
    // This prevents the 60s Axios timeout on the frontend
    sendVerificationEmail(inputEmail, code).catch(err => {
      console.error(`[BACKGROUND EMAIL ERROR] Failed to send to ${inputEmail}:`, err.message);
    });

    return res.status(201).json({
      message: "تم إنشاء طلبك. ستصلك رسالة التحقق على بريدك الإلكتروني خلال لحظات.",
      email: inputEmail,
      note: "إذا لم تصلك الرسالة خلال دقيقة، يرجى التحقق من البريد المزعج (Spam) أو طلب إعادة الإرسال."
    });

  } catch (err) {
    console.error("Register email error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

/**
 * Validates a username (name)
 * 1. Must not be purely numeric
 * 2. Must be unique in the database
 * @param {string} name 
 * @param {string|null} excludeUserId
 * @returns {Promise<{isValid: boolean, error?: string}>}
 */
async function validateUsername(name, excludeUserId = null) {
  const trimmedName = String(name || "").trim();
  
  if (!trimmedName) {
    return { isValid: false, error: "الاسم مطلوب." };
  }

  // Check if purely numeric
  if (/^\d+$/.test(trimmedName)) {
    return { isValid: false, error: "لا يمكن أن يكون الاسم أرقاماً فقط." };
  }

  // Check uniqueness (case-insensitive)
  const esc = (s) => s.replace(/[.*+?^${}()|[\ ]\\]/g, "\\$&");
  const query = { 
    name: { $regex: new RegExp(`^${esc(trimmedName)}$`, "i") } 
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const existingUser = await User.findOne(query);

  if (existingUser) {
    return { isValid: false, error: "هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر." };
  }

  return { isValid: true };
}

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Deprecated email registration verification endpoint
 *     deprecated: true
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       410:
 *         description: Email-based account registration is disabled
 */
router.post("/verify-email", (_req, res) => {
  return res.status(410).json({ error: "تسجيل الحسابات الجديدة بالبريد الإلكتروني غير متاح." });
}, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "البريد الإلكتروني والرمز مطلوبان." });

    const inputEmail = String(email).trim().toLowerCase();
    const inputCode = String(code).trim();

    const otp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1 });
    if (!otp) {
      logSecurityEvent("Email verification failed: No OTP", req, { email: inputEmail });
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي الصلاحية." });
    }

    // Check if locked
    if (otp.lockedUntil && otp.lockedUntil > new Date()) {
      const remaining = Math.ceil((otp.lockedUntil - new Date()) / 1000 / 60);
      logSecurityEvent("Email verification blocked: too many attempts", req, { email: inputEmail });
      return res.status(403).json({ error: `تم إدخال رمز التحقق بشكل خاطئ عدة مرات، حاول مرة أخرى بعد ${remaining} دقائق.` });
    }

    if (otp.codeExpiresAt < new Date()) {
      logSecurityEvent("Email verification failed: Code expired", req, { email: inputEmail });
      return res.status(400).json({ error: "انتهت صلاحية رمز التحقق." });
    }

    // Verify code
    const isMatch = await bcrypt.compare(inputCode, otp.code);
    if (!isMatch) {
      otp.attempts += 1;
      logSecurityEvent("Email verification failed: Wrong code", req, { email: inputEmail, attempt: otp.attempts });
      
      if (otp.attempts >= 5) {
        otp.lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock
        await otp.save();
        return res.status(403).json({ error: "تم إدخال رمز التحقق بشكل خاطئ عدة مرات، حاول مرة أخرى بعد 10 دقائق." });
      }
      
      await otp.save();
      return res.status(400).json({ error: "الرمز غير صحيح." });
    }

    // Success: Create actual User account
    let user = await User.findOne({ email: inputEmail });
    
    // Check if existing user is blocked
    if (user && user.isDisabled) {
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }

    if (!user) {
      // Final check for username uniqueness before creating user
      const nameValidation = await validateUsername(otp.name);
      if (!nameValidation.isValid) {
        return res.status(400).json({ error: nameValidation.error });
      }

      user = await User.create({
        name: otp.name,
        email: inputEmail,
        password: otp.password,
        role: "user",
        isEmailVerified: true,
        verified: false,
        verifiedAt: null
      });
      await ReferralEngine.ensureProfile(user._id);
      await ReferralEngine.claimAttribution(user._id, req.cookies?.souqak_referral);
    } else {
      user.isEmailVerified = true;
      user.verified = false;
      user.verifiedAt = null;
      await user.save();
    }

    // Delete all codes for this email immediately after success
    await OtpCode.deleteMany({ email: inputEmail });
    console.log(`[LOG] Verify success: ${inputEmail}`);

    // Generate tokens and set cookies
    const { accessToken } = await sendAuthResponse(user, res);

    res.json({
      message: "تم تفعيل حسابك بنجاح، مرحبًا بك في سوقك.",
      token: accessToken, // Still return for legacy frontend
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        verified: false,
        verificationStatus: user.verificationStatus,
        verificationExpiryDate: user.verificationExpiryDate
      }
    });

  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/resend-otp", (_req, res) => {
  return res.status(410).json({ error: "إعادة إرسال رموز تسجيل البريد الإلكتروني غير متاحة." });
}, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب." });

    const inputEmail = String(email).trim().toLowerCase();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputEmail)) {
      return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة." });
    }

    // Check if user already exists
    const user = await User.findOne({ email: inputEmail });
    if (user && user.isEmailVerified) return res.status(400).json({ error: "البريد الإلكتروني مفعّل بالفعل." });

    // Rate limiting: max 3 codes per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const codeCount = await OtpCode.countDocuments({
      email: inputEmail,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (codeCount >= 3) {
      return res.status(429).json({ error: "لقد تجاوزت الحد المسموح به من الطلبات. حاول مرة أخرى بعد 5 دقائق." });
    }

    // Get the original name and password if they were in the previous OtpCode
    const oldOtp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1 });
    if (!oldOtp && !user) {
        return res.status(400).json({ error: "بيانات التسجيل غير موجودة. يرجى التسجيل مرة أخرى." });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for code
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes for session

    // Store code hashed
    const hashedCode = await bcrypt.hash(code, 10);
    
    // Clear old registration attempts for this email
    await OtpCode.deleteMany({ email: inputEmail });

    // Create new OTP keeping registration data if available
    await OtpCode.create({
      name: oldOtp?.name,
      email: inputEmail,
      password: oldOtp?.password,
      code: hashedCode,
      codeExpiresAt,
      expiresAt
    });

    console.log(`[AUTH] Resend OTP created in DB for: ${inputEmail} (sending in background)`);

    // ASYNCHRONOUS BACKGROUND EMAIL SENDING
    sendVerificationEmail(inputEmail, code).catch(err => {
      console.error(`[BACKGROUND EMAIL ERROR] Failed to resend to ${inputEmail}:`, err.message);
    });

    return res.json({ 
      message: "تم إرسال رمز جديد. يرجى التحقق من بريدك الإلكتروني." 
    });

  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/forgot-password", accountRecoveryLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب." });

    const inputEmail = String(email).trim().toLowerCase();
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputEmail)) {
      return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة." });
    }

    const user = await User.findOne({ email: inputEmail });

    if (!user) {
      // For security, we can return success even if user doesn't exist, 
      // but usually for forgot password, we tell the user if the email is not found.
      // The user specifically asked "if email exists", so I'll check.
      return res.status(404).json({ error: "هذا البريد الإلكتروني غير مسجل لدينا." });
    }
    if (!canUseEmailAccountRecovery(user)) {
      return res.status(403).json({ error: "استعادة الحسابات الشخصية متاحة عبر طلب الاستعادة بالهاتف." });
    }

    // Rate limiting: max 3 codes per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const codeCount = await OtpCode.countDocuments({
      email: inputEmail,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (codeCount >= 3) {
      return res.status(429).json({ error: "لقد تجاوزت الحد المسموح به من الطلبات. حاول مرة أخرى بعد 5 دقائق." });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for reset code
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes record TTL

    // Store hashed code
    const hashedCode = await bcrypt.hash(code, 10);
    
    await OtpCode.create({
      email: inputEmail,
      code: hashedCode,
      codeExpiresAt,
      expiresAt
    });

    // ASYNCHRONOUS BACKGROUND EMAIL SENDING
    sendPasswordResetEmail(inputEmail, code).catch(err => {
      console.error(`[BACKGROUND EMAIL ERROR] Failed to send reset to ${inputEmail}:`, err.message);
    });

    return res.json({ 
      message: "تم إرسال رمز إعادة التعيين إلى بريدك الإلكتروني." 
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "البريد الإلكتروني والرمز مطلوبان." });

    const inputEmail = String(email).trim().toLowerCase();
    const inputCode = String(code).trim();
    const user = await User.findOne({ email: inputEmail });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    if (!canUseEmailAccountRecovery(user)) {
      return res.status(403).json({ error: "استعادة الحسابات الشخصية متاحة عبر طلب الاستعادة بالهاتف." });
    }

    const otp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1, _id: -1 });
    if (!otp) {
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي الصلاحية." });
    }

    if (isPasswordResetOtpLocked(otp)) {
      const remaining = otp.lockedUntil
        ? Math.ceil((otp.lockedUntil - new Date()) / 1000 / 60)
        : 0;
      return res.status(403).json({
        error: remaining > 0
          ? `تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد ${remaining} دقائق.`
          : "تم تجاوز عدد محاولات الرمز. اطلب رمزًا جديدًا."
      });
    }

    if (otp.codeExpiresAt < new Date()) {
      return res.status(400).json({ error: "رمز التحقق منتهي الصلاحية." });
    }

    if (await hasReachedPasswordResetOtpAttemptLimit(OtpCode, inputEmail)) {
      return res.status(403).json({ error: "تم تجاوز عدد محاولات الرمز. اطلب رمزًا جديدًا بعد انتهاء فترة الحظر." });
    }

    const isMatch = await bcrypt.compare(inputCode, otp.code);
    if (!isMatch) {
      const attempt = await recordInvalidPasswordResetOtpAttempt(OtpCode, otp._id);
      if (attempt.locked) {
        return res.status(403).json({ error: "تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد 10 دقائق." });
      }
      return res.status(400).json({ error: "الرمز غير صحيح." });
    }

    res.json({ message: "تم التحقق من الرمز بنجاح." });
  } catch (err) {
    console.error("Verify reset OTP error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: "جميع الحقول مطلوبة." });

    const inputEmail = String(email).trim().toLowerCase();
    const inputCode = String(code).trim();
    if (!isValidPassword(String(newPassword))) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزًا دون مسافات أو حروف عربية." });
    }
    const user = await User.findOne({ email: inputEmail });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    if (!canUseEmailAccountRecovery(user)) {
      return res.status(403).json({ error: "استعادة الحسابات الشخصية متاحة عبر طلب الاستعادة بالهاتف." });
    }

    const otp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1, _id: -1 });
    if (!otp) return res.status(400).json({ error: "انتهت جلسة إعادة التعيين. حاول مرة أخرى." });

    if (isPasswordResetOtpLocked(otp)) {
      const remaining = otp.lockedUntil
        ? Math.ceil((otp.lockedUntil - new Date()) / 1000 / 60)
        : 0;
      return res.status(403).json({
        error: remaining > 0
          ? `تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد ${remaining} دقائق.`
          : "تم تجاوز عدد محاولات الرمز. اطلب رمزًا جديدًا."
      });
    }

    if (otp.codeExpiresAt < new Date()) return res.status(400).json({ error: "رمز التحقق منتهي الصلاحية." });

    if (await hasReachedPasswordResetOtpAttemptLimit(OtpCode, inputEmail)) {
      return res.status(403).json({ error: "تم تجاوز عدد محاولات الرمز. اطلب رمزًا جديدًا بعد انتهاء فترة الحظر." });
    }

    const isMatch = await bcrypt.compare(inputCode, otp.code);
    if (!isMatch) {
      const attempt = await recordInvalidPasswordResetOtpAttempt(OtpCode, otp._id);
      if (attempt.locked) {
        return res.status(403).json({ error: "تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد 10 دقائق." });
      }
      return res.status(400).json({ error: "الرمز غير صحيح." });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Clear OTP
    await OtpCode.deleteMany({ email: inputEmail });

    res.json({ message: "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/test-email", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب." });
    
    await sendVerificationEmail(email, "123456");
    
    res.json({ message: "Test email sent successfully" });
  } catch (err) {
    console.error("[LOG] Test email failed:", err.message);
    res.status(503).json({ error: "فشل إرسال البريد الإلكتروني.", details: err.message });
  }
});

router.post("/register", (_req, res) => {
  return res.status(410).json({ error: "التسجيل متاح باستخدام رقم الهاتف فقط." });
}, uploadIdDoc.single("idDocument"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزًا دون مسافات أو حروف عربية." });
    }
    
    // Validate username uniqueness and format
    const nameValidation = await validateUsername(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.error });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل." });
    const allowedRole = ["seller", "user"].includes(role) ? role : "user";
    const file = req.file;
    const idDocument = file ? `ids/${file.filename}` : undefined;
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: allowedRole,
      idDocument,
      identityStatus: idDocument ? "Pending" : undefined,
      isVerifiedSeller: false
    });
    await ReferralEngine.ensureProfile(user._id);
    await ReferralEngine.claimAttribution(user._id, req.cookies?.souqak_referral);
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isVerifiedSeller: user.isVerifiedSeller,
      verificationExpiresAt: user.verificationExpiresAt,
      identityStatus: user.identityStatus,
      idDocument: user.idDocument
    });
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

import { logSecurityEvent } from "../utils/logger.js";
import useragent from "useragent";

router.post("/login", async (req, res) => {
  try {
    const { email, password, deviceType, fingerprint, adminLogin } = req.body;
    const input = String(email || "").trim();
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const user =
      (await User.findOne({ email: input })) ||
      (await User.findOne({ email: new RegExp(`^${esc(input)}$`, "i") }));

    if (!user) {
      logSecurityEvent("Login failed: user not found", req, { email: input });
      return res.status(400).json({ error: "بيانات الدخول غير صحيحة." });
    }
    if (adminLogin === true && user.role !== "admin") {
      logSecurityEvent("Admin login denied: insufficient role", req, { userId: user._id });
      return res.status(403).json({ error: "بيانات الدخول غير صحيحة أو لا تملك صلاحية الأدمن." });
    }
    if (!canUseEmailAccountRecovery(user)) {
      return res.status(403).json({ error: "سجّل الدخول باستخدام اسم المستخدم أو رقم الهاتف." });
    }
    
    // 1. Check Lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      logSecurityEvent("Login blocked: account locked", req, { userId: user._id });
      return res.status(403).json({ error: `تم حظر الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد ${remaining} دقيقة.` });
    }

    if (user.isDisabled || user.isDeleted) {
      return res.status(403).json({ error: "هذا الحساب محظور أو محذوف." });
    }

    const ok = await bcrypt.compare(password, user.password);
    
    if (!ok) {
      // 2. Handle Login Failure & Increment Attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 mins
        user.loginAttempts = 0;
      }
      await user.save();
      
      logSecurityEvent("Login failed: wrong password", req, { userId: user._id, attempts: user.loginAttempts });
      return res.status(400).json({ error: "بيانات الدخول غير صحيحة." });
    }

    // 3. Login Success - Reset attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.clientIp || req.ip;
    
    if (fingerprint) user.deviceFingerprint = fingerprint;

    // Track device login
    if (deviceType && ["android", "ios", "windows", "macos"].includes(deviceType)) {
      if (!user.devices) user.devices = { android: 0, ios: 0, windows: 0, macos: 0 };
      user.devices[deviceType] = (user.devices[deviceType] || 0) + 1;
    }
    
    await user.save();
    await ReferralEngine.ensureProfile(user._id);

    // Generate tokens and set cookies
    const { accessToken } = await sendAuthResponse(user, res);

    logSecurityEvent("Login successful", req, { userId: user._id });

    res.json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isEmailVerified: user.isEmailVerified,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
        isVerifiedSeller: user.isVerifiedSeller,
        verified: !!user.verified,
        verificationExpiresAt: user.verificationExpiresAt,
        verificationStatus: user.verificationStatus,
        verificationExpiryDate: user.verificationExpiryDate,
        identityStatus: user.identityStatus,
        idDocument: user.idDocument
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/phone-register", phoneRegistrationLimit, async (req, res) => {
  try {
    const { name, phone, password } = req.body || {};
    if (!name || !phone || typeof password !== "string") return res.status(400).json({ error: "جميع الحقول مطلوبة." });

    const p = normalizePhone(phone);
    const n = String(name).trim();

    if (!p || !isValidPhoneNumber(p)) {
      return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام فقط بدون زيادة أو نقصان." });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزًا دون مسافات أو حروف عربية." });
    }

    const existing = await User.findOne(phoneNumberQuery(p));
    if (existing) {
      return res.status(409).json({ error: "هذا الرقم مسجل مسبقًا. يرجى تسجيل الدخول." });
    }

    const nameValidation = await validateUsername(n);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.error });
    }

    const hash = await bcrypt.hash(password, 10);
    const email = `${p}@phone.local`;

    const user = await User.create({
      name: n,
      email,
      password: hash,
      role: "user",
      phone: p,
      phoneTrial: false,
      phoneTrialStatus: "Approved",
      phoneRegistrationMode: "instant",
      isEmailVerified: true,
      phoneVerifiedAt: null,
      mustResetPassword: false,
      temporaryPassword: null,
      temporaryPasswordExpiresAt: null
    });
    await ReferralEngine.ensureProfile(user._id);
    await ReferralEngine.claimAttribution(user._id, req.cookies?.souqak_referral);

    const { accessToken } = await sendAuthResponse(user, res);

    await createAdminNotification(req.app, {
      type: "new_user",
      title: "إنشاء حساب جديد عبر الهاتف",
      message: `تم إنشاء حساب جديد عبر الهاتف: ${user.name} - ${user.phone}`,
      link: "/admin/users",
      data: { userId: String(user._id), phone: user.phone, requestType: "phone_registration" }
    });

    res.status(201).json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        phoneVerifiedAt: null
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "اسم المستخدم أو رقم الهاتف مسجل مسبقًا." });
    }
    console.error("Phone register error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/phone-status/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    res.json({ status: user.phoneRegistrationMode === "instant" ? "Approved" : user.phoneTrialStatus || "Pending" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/phone-login", phoneLoginLimit, async (req, res) => {
  try {
    const { identifier, password, deviceType } = req.body || {};
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const input = String(identifier || "").trim();
    const rawPassword = String(password || "");

    if (!input || !rawPassword) {
      return res.status(400).json({ error: "اسم المستخدم أو رقم الهاتف وكلمة المرور مطلوبان." });
    }

    const phoneQuery = phoneNumberQuery(input);
    const byPhone = phoneQuery ? await User.findOne(phoneQuery) : null;
    const byName =
      (await User.findOne({ name: input })) ||
      (await User.findOne({ name: new RegExp(`^${esc(input)}$`, "i") }));

    const user = byPhone || byName;
    if (!user) {
      return res.status(404).json({ error: "بيانات الدخول غير صحيحة أو الحساب غير موجود." });
    }

    if (user.isDisabled) {
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }
    if (user.isDeleted) {
      return res.status(403).json({ error: "هذا الحساب محذوف." });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(403).json({ error: `تم حظر الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد ${remaining} دقيقة.` });
    }

    if (user.managedAccount?.createdByAdmin && !user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    const passwordMatches = await bcrypt.compare(rawPassword, user.password);
    const temporaryMatches = !!user.temporaryPassword
      && user.temporaryPassword === rawPassword
      && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt > new Date());

    if (!passwordMatches && !temporaryMatches) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000;
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: "كلمة المرور غير صحيحة." });
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.clientIp || req.ip;
    await user.save();

    if (user.mustResetPassword) {
      const { accessToken } = await sendAuthResponse(user, res);
      return res.status(200).json({
        token: accessToken,
        requiresPasswordReset: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          permissions: Array.isArray(user.permissions) ? user.permissions : [],
          isEmailVerified: user.isEmailVerified,
          phoneVerifiedAt: user.phoneVerifiedAt || null,
          isVerifiedSeller: user.isVerifiedSeller,
          verified: !!user.verified,
          verificationExpiresAt: user.verificationExpiresAt,
          verificationStatus: user.verificationStatus,
          verificationExpiryDate: user.verificationExpiryDate,
          avatar: user.avatar,
          identityStatus: user.identityStatus,
          idDocument: user.idDocument,
          managedAccount: user.managedAccount
        }
      });
    }

    if (deviceType && ["android", "ios", "windows", "macos"].includes(deviceType)) {
      if (!user.devices) user.devices = { android: 0, ios: 0, windows: 0, macos: 0 };
      user.devices[deviceType] = (user.devices[deviceType] || 0) + 1;
      await user.save();
    }

    const { accessToken } = await sendAuthResponse(user, res);
    return res.json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isEmailVerified: user.isEmailVerified,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
        isVerifiedSeller: user.isVerifiedSeller,
        verified: !!user.verified,
        verificationExpiresAt: user.verificationExpiresAt,
        verificationStatus: user.verificationStatus,
        verificationExpiryDate: user.verificationExpiryDate,
        avatar: user.avatar,
        identityStatus: user.identityStatus,
          idDocument: user.idDocument,
          managedAccount: user.managedAccount
      }
    });
  } catch (error) {
    console.error("Phone login error:", error);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/password-reset-request", accountRecoveryLimit, async (req, res) => {
  try {
    const { username, phone } = req.body || {};
    if (!username || !phone) {
      return res.status(400).json({ error: "اسم المستخدم ورقم الهاتف مطلوبان." });
    }

    const cleanPhone = normalizePhone(phone);
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام فقط." });
    }

    const user = await User.findOne({ name: String(username).trim() });
    if (!user) {
      return res.status(404).json({ error: "هذا المستخدم غير موجود." });
    }

    const isMatchByPhone = normalizePhone(user.phone || "") === cleanPhone;
    if (!isMatchByPhone) {
      return res.status(400).json({ error: "اسم المستخدم لا يطابق رقم الهاتف المسجل." });
    }

    const request = await PasswordResetRequest.create({
      username: user.name,
      phone: cleanPhone,
      status: "pending",
      requestedAt: new Date()
    });

    await User.findByIdAndUpdate(user._id, {
      passwordResetRequestedAt: new Date()
    });

    await createAdminNotification(req.app, {
      type: "new_user",
      title: "طلب استعادة كلمة المرور",
      message: `تم إرسال طلب استعادة كلمة المرور من المستخدم: ${user.name} - ${cleanPhone}`,
      link: "/admin/password-reset-requests",
      data: { userId: String(user._id), requestId: String(request._id), username: user.name, phone: cleanPhone }
    });

    const message = buildPasswordResetRequestMessage(user.name, cleanPhone);

    return res.status(201).json({
      message: "تم إرسال طلب استعادة كلمة المرور إلى الإدارة.",
      waMessage: message,
      waLink: `https://wa.me/967737462126?text=${encodeURIComponent(message)}`,
      requestId: request._id
    });
  } catch (err) {
    console.error("Password reset request error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/set-new-password", auth, async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body || {};
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: "كلمة المرور الجديدة وتأكيدها مطلوبان." });
    }

    if (!isValidPassword(String(newPassword))) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزاً." });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.mustResetPassword = false;
    user.temporaryPassword = null;
    user.temporaryPasswordExpiresAt = null;
    if (user.managedAccount?.status === "claim_pending") {
      user.managedAccount.status = "claimed";
      user.managedAccount.claimedAt = new Date();
    }
    await user.save();

    return res.json({ message: "تم تعيين كلمة المرور الجديدة بنجاح." });
  } catch (err) {
    console.error("Set new password error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      identityStatus: user.identityStatus,
      idDocument: user.idDocument,
      isVerifiedSeller: !!user.isVerifiedSeller,
      verified: !!user.verified,
      verificationExpiresAt: user.verificationExpiresAt,
      verificationStatus: user.verificationStatus,
      verificationExpiryDate: user.verificationExpiryDate
    });
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// Update profile avatar
router.post("/avatar", auth, (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.log('[AVATAR] Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)." });
      }
      return res.status(400).json({ error: "خطأ في رفع الملف." });
    } else if (err) {
      console.log('[AVATAR] Upload error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      console.log('[AVATAR] No file provided');
      return res.status(400).json({ error: "مطلوب إرفاق صورة." });
    }
    
    console.log('[AVATAR] Received file:', file.path);

    const avatarPath = `avatars/${file.filename}`;
    console.log('[AVATAR] Database path:', avatarPath);

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarPath },
      { new: true }
    ).lean();
    
    if (!updated) {
      console.log('[AVATAR] User not found during update:', req.user.id);
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    console.log('[AVATAR] Success for user:', req.user.id);
    res.json({
      id: updated._id,
      avatar: updated.avatar
    });
  } catch (err) {
    console.error("[AVATAR] Detailed upload error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء رفع الصورة.", details: err.message });
  }
});

router.post("/id-document", auth, uploadIdDoc.single("idDocument"), async (req, res) => {
  try {
    if (req.user.role !== "seller") return res.status(403).json({ error: "غير مسموح." });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "مطلوب إرفاق وثيقة الهوية." });
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { idDocument: `ids/${file.filename}`, identityStatus: "Pending", isVerifiedSeller: false },
      { new: true }
    ).lean();
    res.json({
      id: updated._id,
      idDocument: updated.idDocument,
      identityStatus: updated.identityStatus
    });
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/activate-verification", auth, async (req, res) => {
  try {
    if (req.user.role !== "seller") return res.status(403).json({ error: "غير مسموح." });
    const user = await User.findById(req.user.id).lean();
    if (!user?.idDocument) return res.status(400).json({ error: "مطلوب إرفاق وثيقة الهوية أولاً." });
    if (user.identityStatus !== "Approved") return res.status(400).json({ error: "لم يتم الموافقة على الهوية بعد." });
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const updated = await User.findByIdAndUpdate(req.user.id, {
      isVerifiedSeller: true,
      verified: true,
      verificationStatus: "verified",
      verificationDate: new Date(),
      verificationExpiryDate: expires,
      verificationExpiresAt: expires
    }, { new: true }).lean();
    res.json({
      id: updated._id,
      isVerifiedSeller: updated.isVerifiedSeller,
      verificationExpiresAt: updated.verificationExpiresAt,
      verificationStatus: updated.verificationStatus,
      verificationExpiryDate: updated.verificationExpiryDate
    });
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/subscribe", auth, async (req, res) => {
  try {
    const { subscription, deviceType } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if subscription already exists
    const exists = user.pushSubscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceType: deviceType || "desktop",
        userAgent: req.headers["user-agent"]
      });
      await user.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/unsubscribe", auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { pushSubscriptions: { endpoint } }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/vapid-public-key", (req, res) => {
  if (!isPushConfigured || !process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications are not configured" });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// تحديث الملف الشخصي
router.patch("/update-profile", auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });

    if (name) {
      // Validate username using the common helper, excluding the current user
      const nameValidation = await validateUsername(name, user._id);
      if (!nameValidation.isValid) {
        return res.status(400).json({ error: nameValidation.error });
      }
      user.name = name.trim();
    }

    if (phone !== undefined && String(phone).trim()) {
      const normalizedPhone = normalizePhone(phone);
      if (!isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({ error: "رقم الهاتف غير صالح." });
      }
      const phoneQuery = phoneNumberQuery(normalizedPhone);
      phoneQuery._id = { $ne: user._id };
      if (await User.exists(phoneQuery)) {
        return res.status(409).json({ error: "رقم الهاتف مسجل مسبقًا." });
      }
      if (normalizePhone(user.phone) !== normalizedPhone) {
        user.phone = normalizedPhone;
        user.phoneVerifiedAt = null;
        await PhoneVerificationRequest.updateMany(
          { user: user._id, status: { $in: ["pending_admin_review", "code_issued"] } },
          {
            $set: { status: "expired", codeHash: null, codeExpiresAt: null },
            $push: {
              actions: {
                action: "expired",
                actor: user._id,
                at: new Date(),
                note: "تغير رقم الهاتف"
              }
            }
          }
        );
      }
    }

    await user.save();
    res.json({
      message: "تم تحديث الملف الشخصي بنجاح.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller
      }
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.phone) {
      return res.status(409).json({ error: "رقم الهاتف مسجل مسبقًا." });
    }
    console.error("Update profile error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// تغيير دور المستخدم
router.patch("/switch-role", auth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "seller", "buyer"].includes(role)) {
      return res.status(400).json({ error: "الدور غير صالح. الخيارات المتاحة: user, seller, buyer" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });

    res.json({
      message: "تم تغيير الدور بنجاح.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller
      }
    });
  } catch (err) {
    console.error("Switch role error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// تغيير كلمة المرور
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة." });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون من 8 إلى 24 رمزًا دون مسافات أو حروف عربية." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "تم تغيير كلمة المرور بنجاح." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// طلب حذف الحساب نهائياً
router.delete("/account", auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "كلمة المرور أو رمز التأكيد مطلوب." });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    // التحقق مما إذا كان المستخدم مسجلاً بالهاتف (ليس لديه كلمة مرور معروفة)
    const isPhoneUser = user.email && user.email.endsWith("@phone.local");

    if (isPhoneUser) {
      // مستخدم الهاتف يتأكد بكتابة كلمة "حذف"
      if (password !== "حذف") {
        return res.status(400).json({ error: 'يرجى كتابة كلمة "حذف" بشكل صحيح للتأكيد.' });
      }
    } else {
      // مستخدم البريد يتأكد بكلمة المرور
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: "كلمة المرور غير صحيحة." });
      }
    }

    // 2. التحقق من الشروط المالية والعمليات الجارية

    // أ. رصيد معلق
    const wallet = await Wallet.findOne({ user: userId });
    if (wallet && wallet.balances) {
      const hasPendingBalance = wallet.balances.some(b => b.pendingBalance > 0);
      if (hasPendingBalance) {
        return res.status(400).json({ 
          error: "لا يمكنك حذف الحساب حالياً لوجود رصيد معلق في محفظتك. يرجى الانتظار حتى اكتمال العمليات." 
        });
      }
    }

    // ب. نزاعات مفتوحة (سواء كان فاتح النزاع أو الطرف الآخر)
    // نحتاج للبحث عن النزاعات المرتبطة بطلبات المستخدم
    const userOrders = await Order.find({ 
      $or: [{ buyer: userId }, { seller: userId }] 
    }).select("_id");
    const userOrderIds = userOrders.map(o => o._id);
    
    const openDispute = await Dispute.findOne({ 
      order: { $in: userOrderIds },
      status: "OPEN"
    });
    if (openDispute) {
      return res.status(400).json({ 
        error: "لا يمكنك حذف الحساب لوجود نزاعات مفتوحة قيد التحقيق." 
      });
    }

    // ج. طلبات سحب قيد المعالجة
    const pendingWithdrawal = await Withdrawal.findOne({ 
      user: userId, 
      status: { $in: ["PENDING", "PROCESSING"] } 
    });
    if (pendingWithdrawal) {
      return res.status(400).json({ 
        error: "لديك طلب سحب أموال قيد المعالجة، يرجى الانتظار حتى اكتمال السحب." 
      });
    }

    // د. طلبات شراء جارية
    const activeOrder = await Order.findOne({
      $or: [{ buyer: userId }, { seller: userId }],
      status: { $nin: ["COMPLETED", "CANCELLED"] }
    });
    if (activeOrder) {
      return res.status(400).json({ 
        error: "لديك طلبات شراء أو بيع جارية لم تكتمل بعد." 
      });
    }

    // 3. تنفيذ الحذف الناعم
    user.isDeleted = true;
    user.deletionRequestedAt = new Date();
    await user.save();

    // 4. إخفاء الإعلانات
    await Ad.updateMany({ userId: userId }, { isVisible: false });

    // Clear cookies on account deletion
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({ message: "تم إرسال طلب حذف الحساب بنجاح. سيتم تعطيل حسابك فوراً وحذفه نهائياً خلال 30 يوم." });

  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// Logout
router.post("/logout", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, { refreshToken: null });
    
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    
    res.json({ message: "تم تسجيل الخروج بنجاح." });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// Refresh Token
router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyRefreshToken(refreshToken);
    const claims = inspectJwtClaimsOnly(refreshToken);
    const alg = claims?.header?.alg || "?";
    
    const user = await User.findById(payload.id);
    if (!user || user.refreshToken !== refreshToken) {
      console.log(
        `[Auth][/refresh-token] FAILED invalid refresh (alg=${alg}) uid=${payload.id}`
      );
      return res.status(401).json({ error: "Unauthorized: Invalid refresh token" });
    }

    if (user.isDisabled || user.isDeleted) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { accessToken } = await sendAuthResponse(user, res);
    
    console.log(
      `[Auth][/refresh-token] OK (alg=${alg}) uid=${user._id} role=${user.role}`
    );
    res.json({ token: accessToken });
  } catch (err) {
    console.error(`[Auth][/refresh-token] FAILED: ${err.name} ${err.message}`);
    res.status(401).json({ error: "Unauthorized: Session expired" });
  }
});

export default router;
