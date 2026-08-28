import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import User from "../models/User.js";
import OtpCode from "../models/OtpCode.js";
import auth, { sendAuthResponse } from "../middleware/auth.js";
import { uploadIdDoc, uploadAvatar, processImage } from "../middleware/upload.js";
import { requireRole } from "../middleware/roles.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/emailSender.js";
import Order from "../models/Order.js";
import Dispute from "../models/Dispute.js";
import Withdrawal from "../models/Withdrawal.js";
import Wallet from "../models/Wallet.js";
import Ad from "../models/Ad.js";
import {
  signAccessToken,
  verifyRefreshToken,
  JWT_ALGORITHM,
  inspectJwtClaimsOnly,
} from "../config/jwt.js";

const router = Router();

/**
 * @swagger
 * /api/auth/register-email:
 *   post:
 *     summary: Register a new user using email
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
 *       201:
 *         description: Verification code sent to email
 *       400:
 *         description: Missing fields or user already exists
 */
router.post("/register-email", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    
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
 *     summary: Verify email using OTP code
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
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired code
 */
router.post("/verify-email", async (req, res) => {
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
        verified: false
      }
    });

  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/resend-otp", async (req, res) => {
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

    console.log(`[AUTH] Resend OTP created in DB for: ${inputEmail}. Code: ${code} (sending in background)`);

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

router.post("/forgot-password", async (req, res) => {
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
    
    await OtpCode.deleteMany({ email: inputEmail });
    await OtpCode.create({
      email: inputEmail,
      code: hashedCode,
      codeExpiresAt,
      expiresAt
    });

    console.log(`[AUTH] Reset OTP created in DB for: ${inputEmail}. Code: ${code} (sending in background)`);

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

    const otp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1 });
    if (!otp) {
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي الصلاحية." });
    }

    if (otp.lockedUntil && otp.lockedUntil > new Date()) {
      const remaining = Math.ceil((otp.lockedUntil - new Date()) / 1000 / 60);
      return res.status(403).json({ error: `تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد ${remaining} دقائق.` });
    }

    if (otp.codeExpiresAt < new Date()) {
      return res.status(400).json({ error: "رمز التحقق منتهي الصلاحية." });
    }

    const isMatch = await bcrypt.compare(inputCode, otp.code);
    if (!isMatch) {
      otp.attempts += 1;
      if (otp.attempts >= 5) {
        otp.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
        await otp.save();
        return res.status(403).json({ error: "تم إدخال الرمز بشكل خاطئ عدة مرات، حاول مرة أخرى بعد 10 دقائق." });
      }
      await otp.save();
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

    const otp = await OtpCode.findOne({ email: inputEmail }).sort({ createdAt: -1 });
    if (!otp) return res.status(400).json({ error: "انتهت جلسة إعادة التعيين. حاول مرة أخرى." });

    if (otp.codeExpiresAt < new Date()) return res.status(400).json({ error: "رمز التحقق منتهي الصلاحية." });

    const isMatch = await bcrypt.compare(inputCode, otp.code);
    if (!isMatch) return res.status(400).json({ error: "الرمز غير صحيح." });

    // Update password
    const user = await User.findOne({ email: inputEmail });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });

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

router.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب." });
    
    console.log(`Testing email sending to: ${email}`);
    await sendVerificationEmail(email, "123456");
    
    res.json({ message: "Test email sent successfully" });
  } catch (err) {
    console.error("[LOG] Test email failed:", err.message);
    res.status(503).json({ error: "فشل إرسال البريد الإلكتروني.", details: err.message });
  }
});

router.post("/register", uploadIdDoc.single("idDocument"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    
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
    const { email, password, deviceType, fingerprint } = req.body;
    const input = String(email || "").trim();
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const user =
      (await User.findOne({ email: input })) ||
      (await User.findOne({ email: new RegExp(`^${esc(input)}$`, "i") }));

    if (!user) {
      logSecurityEvent("Login failed: user not found", req, { email: input });
      return res.status(400).json({ error: "بيانات الدخول غير صحيحة." });
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
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller,
        verified: !!user.verified,
        verificationExpiresAt: user.verificationExpiresAt,
        identityStatus: user.identityStatus,
        idDocument: user.idDocument
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/phone-register", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "جميع الحقول مطلوبة." });
    
    const p = String(phone).trim();
    const n = String(name).trim();
    
    let existing = await User.findOne({ phone: p });

    // Validate username uniqueness and format, excluding the existing user if found
    const nameValidation = await validateUsername(n, existing?._id);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.error });
    }

    if (existing) {
      if (existing.phoneTrialStatus === "Rejected") {
        // Allow re-registration if rejected
        existing.name = n;
        existing.phoneTrialStatus = "Pending";
        existing.isDisabled = false;
        await existing.save();
        
        const token = signAccessToken({ id: existing._id, role: existing.role });
        const claims = inspectJwtClaimsOnly(token);
        console.log(
          `[Auth][register/re-reg] temp token algo=${claims?.header?.alg || "?"} exp=7d (centralized) uid=${existing._id}`
        );
        return res.status(200).json({
          token,
          requiresActivation: true,
          user: {
            id: existing._id,
            name: existing.name,
            email: existing.email,
            phone: existing.phone,
            role: existing.role
          }
        });
      }
      
      if (existing.phoneTrialStatus === "Pending") {
        return res.status(400).json({ error: "هذا الرقم قيد المراجعة حالياً. يرجى الانتظار." });
      }
      
      return res.status(400).json({ error: "هذا الرقم مسجل مسبقاً. يرجى تسجيل الدخول." });
    }
    
    // Generate a secure random password for phone-only users
    const password = Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(password, 10);
    
    // Create a shadow email for internal use
    const email = `${p}@phone.local`;
    
    const user = await User.create({
      name: n,
      email,
      password: hash,
      role: "user",
      phone: p,
      phoneTrial: false,
      phoneTrialStatus: "Pending",
      isEmailVerified: true // Phone users are considered verified on registration for now
    });

    // Generate tokens and set cookies
    const { accessToken } = await sendAuthResponse(user, res);

    res.status(201).json({
      token: accessToken,
      requiresActivation: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Phone register error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.get("/phone-status/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    res.json({ status: user.phoneTrialStatus || "Pending" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

router.post("/phone-login", async (req, res) => {
  try {
    const { identifier, name, phone, deviceType } = req.body || {};
    const esc = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");

    let user = null;
    // Preferred flow: name + phone for regular users
    if (name && phone) {
      const n = String(name).trim();
      const p = String(phone).trim();
      user =
        (await User.findOne({ name: n, phone: p })) ||
        (await User.findOne({ name: new RegExp(`^${esc(n)}$`, "i"), phone: p }));
      if (!user) return res.status(404).json({ error: "بيانات الدخول غير صحيحة أو الحساب غير موجود." });
      const isBypass = user.role === "admin" || String(user.name).toLowerCase() === "seller test";
      if (!isBypass && user.phoneTrial !== true) {
        const msg = user.phoneTrialStatus === "Rejected" ? "تم رفض التفعيل" : "الحساب قيد التفعيل";
        const code = user.phoneTrialStatus === "Rejected" ? "REJECTED" : "PENDING";
        return res.status(403).json({ error: msg, code });
      }
    } else {
      // Fallback: single identifier for admin/seller test convenience
      const input = String(identifier || "").trim();
      if (!input) return res.status(400).json({ error: "البريد أو الهاتف مطلوب." });
      const byPhone = await User.findOne({ phone: input });
      const byName =
        (await User.findOne({ name: input })) ||
        (await User.findOne({ name: new RegExp(`^${esc(input)}$`, "i") }));
      const byEmail =
        (await User.findOne({ email: input })) ||
        (await User.findOne({ email: new RegExp(`^${esc(input)}$`, "i") }));
      user = byPhone || byName || byEmail;
      if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    // Check if user is blocked
    if (user.isDisabled) {
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }

    const isBypass = user.role === "admin" || String(user.name).toLowerCase() === "seller test";
    if (!isBypass && user.phoneTrial !== true) {
      const msg = user.phoneTrialStatus === "Rejected" ? "تم رفض التفعيل" : "الحساب قيد التفعيل";
      const code = user.phoneTrialStatus === "Rejected" ? "REJECTED" : "PENDING";
      return res.status(403).json({ error: msg, code });
    }

    // Track device login
    if (deviceType && ["android", "ios", "windows", "macos"].includes(deviceType)) {
      if (!user.devices) user.devices = { android: 0, ios: 0, windows: 0, macos: 0 };
      user.devices[deviceType] = (user.devices[deviceType] || 0) + 1;
      await user.save();
    }

    // Generate tokens and set cookies
    const { accessToken } = await sendAuthResponse(user, res);

    res.json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isVerifiedSeller: user.isVerifiedSeller,
        verified: !!user.verified,
        verificationExpiresAt: user.verificationExpiresAt,
        avatar: user.avatar,
        identityStatus: user.identityStatus,
        idDocument: user.idDocument
      }
    });
  } catch {
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
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      identityStatus: user.identityStatus,
      idDocument: user.idDocument,
      isVerifiedSeller: !!user.isVerifiedSeller,
      verified: !!user.verified,
      verificationExpiresAt: user.verificationExpiresAt
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

    // Process and optimize avatar image
    const processedPath = await processImage(file.path, "avatar");
    console.log('[AVATAR] Processed path:', processedPath);

    const avatarFilename = path.basename(processedPath);
    const avatarPath = `avatars/${avatarFilename}`;
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
      verificationExpiresAt: updated.verificationExpiresAt
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

    if (phone) {
      user.phone = phone.trim();
    }

    await user.save();
    res.json({
      message: "تم تحديث الملف الشخصي بنجاح.",
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

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل." });
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
