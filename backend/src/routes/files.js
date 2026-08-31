import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import { resolveInlineFileHeaders } from "../utils/filePreview.js";
import Order from "../models/Order.js";
import VerificationRequest from "../models/VerificationRequest.js";
import Withdrawal from "../models/Withdrawal.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Commission from "../models/Commission.js";
import {
  verifyAccessToken,
  inspectJwtClaimsOnly,
  JWT_ALGORITHM,
  getAccessSecretFingerprint,
} from "../config/jwt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");

const _ACCESS_FP = getAccessSecretFingerprint();
console.log(
  `[FilesRoute] Verify using Access secret len=${_ACCESS_FP.length} sha=${_ACCESS_FP.sha256first12} algo=${JWT_ALGORITHM}`
);

const router = Router();

function buildErrorSvg(message, subtitle = "") {
  const safeMsg = String(message).replace(/[<>&"']/g, "");
  const safeSub = String(subtitle).replace(/[<>&"']/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fef2f2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fee2e2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="400" cy="230" r="90" fill="#fecaca" stroke="#ef4444" stroke-width="3"/>
  <text x="400" y="265" font-family="Arial, sans-serif" font-size="110" font-weight="bold" fill="#dc2626" text-anchor="middle">!</text>
  <text x="400" y="390" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#991b1b" text-anchor="middle">${safeMsg}</text>
  ${safeSub ? `<text x="400" y="440" font-family="Arial, sans-serif" font-size="22" fill="#7f1d1d" text-anchor="middle">${safeSub}</text>` : ""}
  <text x="400" y="520" font-family="Arial, sans-serif" font-size="16" fill="#6b7280" text-anchor="middle">منصة سوق • Suqaq Platform</text>
</svg>`;
}

function wantsHtmlOrImage(req) {
  const accept = (req.headers.accept || "").toLowerCase();
  return accept.includes("text/html") || accept.includes("image/") || accept.includes("*/*");
}

function sendErrorResponse(req, res, status, jsonMessage, svgMessage, svgSubtitle = "") {
  if (wantsHtmlOrImage(req)) {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).send(buildErrorSvg(svgMessage, svgSubtitle));
  }
  return res.status(status).json({ error: jsonMessage });
}

async function optionalAuthFileAccess(req, res, next) {
  console.log("[FileDebug]", {
    method: req.method,
    path: req.path,
    hasCookieToken: !!(req.cookies?.token || req.cookies?.accessToken),
    hasQueryToken: !!req.query?.access_token,
    hasAuthorizationHeader: !!req.headers.authorization,
    origin: req.headers.origin || null,
  });

  const candidates = [];

  if (req.headers.authorization?.startsWith("Bearer ")) {
    candidates.push({
      source: "header",
      token: req.headers.authorization.slice(7).trim(),
    });
  }

  if (req.query?.access_token) {
    candidates.push({
      source: "query",
      token: String(req.query.access_token).trim(),
    });
  }

  if (req.cookies?.token) {
    candidates.push({
      source: "cookie",
      token: req.cookies.token,
    });
  }

  if (req.cookies?.accessToken && !req.cookies?.token) {
    candidates.push({
      source: "cookie-accessToken",
      token: req.cookies.accessToken,
    });
  }

  if (candidates.length === 0) {
    console.log(`[FileAuth] No token found (${req.method} ${req.path}) — cookie, query, and header all empty`);
    return next();
  }

  let authenticated = false;

  for (const candidate of candidates) {
    try {
      const claims = inspectJwtClaimsOnly(candidate.token);
      const alg = claims?.header?.alg || "?";
      const payload = verifyAccessToken(candidate.token);
      const uid = payload.userId || payload.id;
      if (!uid) {
        console.log(`[FileAuth] JWT (source=${candidate.source} alg=${alg}) has no userId/id claim for ${req.path} — trying next`);
        continue;
      }
      const user = await User.findById(uid).lean();
      if (user && !user.isDisabled && !user.isDeleted) {
        req.user = {
          id: user._id.toString(),
          role: user.role,
          name: user.name,
          phone: user.phone,
          identityStatus: user.identityStatus,
          isVerifiedSeller: !!user.isVerifiedSeller
        };
        console.log(`[FileAuth] OK (${candidate.source} alg=${alg}) — ${user.role} user ${user._id} for ${req.path}`);
        authenticated = true;
        break;
      } else if (!user) {
        console.log(`[FileAuth] JWT (source=${candidate.source} alg=${alg}) valid but user not found for uid=${uid} — trying next`);
        continue;
      } else {
        console.log(`[FileAuth] JWT (source=${candidate.source} alg=${alg}) valid but user disabled/deleted: ${uid} — trying next`);
        continue;
      }
    } catch (err) {
      const claims = inspectJwtClaimsOnly(candidate.token);
      const alg = claims?.header?.alg || "?";
      console.log(`[FileAuth] JWT verify FAILED (source=${candidate.source} alg=${alg}) for ${req.path}: ${err.message} — trying next`);
      continue;
    }
  }

  if (!authenticated) {
    console.log(`[FileAuth] All ${candidates.length} token candidates failed for ${req.path} — req.user = null`);
  }

  next();
}

router.get(
  "/:folder(ids|kyc|documents|receipts)/:filename",
  optionalAuthFileAccess,
  async (req, res) => {
    try {
      const { folder, filename } = req.params;
      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin";

      const sensitiveFolders = ["ids", "kyc", "documents", "receipts"];
      if (!sensitiveFolders.includes(folder)) {
        return sendErrorResponse(req, res, 400,
          "Not a sensitive folder",
          "طلب غير صالح",
          "المجلد المطلوب غير مدعوم"
        );
      }

      const filePath = path.join(uploadDir, folder, filename);

      if (!fs.existsSync(filePath)) {
        return sendErrorResponse(req, res, 404,
          "File not found",
          "الملف غير متوفر",
          "قد يكون السند قد تم حذفه أو الرابط غير صحيح"
        );
      }

      let isAuthorized = isAdmin;

      if (!isAuthorized && userId) {
        const relativePath = `${folder}/${filename}`;

        if (folder === "ids" || folder === "kyc") {
          const verif = await VerificationRequest.findOne({
            user: userId,
            $or: [
              { idFrontImage: relativePath },
              { idBackImage: relativePath },
              { selfieImage: relativePath }
            ]
          }).lean();
          if (verif) isAuthorized = true;

          if (!isAuthorized) {
            const withdrawal = await Withdrawal.findOne({
              user: userId,
              "bankDetails.identityImage": relativePath
            }).lean();
            if (withdrawal) isAuthorized = true;
          }
        } else if (folder === "receipts") {
          const order = await Order.findOne({
            $and: [
              { $or: [{ buyer: userId }, { seller: userId }] },
              { $or: [
                { "paymentDetails.payments.receiptImage": relativePath },
                { "shippingDetails.shippingReceipt": relativePath }
              ]}
            ]
          }).lean();
          if (order) isAuthorized = true;

          if (!isAuthorized) {
            const pr = await PurchaseRequest.findOne({
              user: userId,
              paymentReceipt: relativePath
            }).lean();
            if (pr) isAuthorized = true;
          }

          if (!isAuthorized) {
            const withdrawal = await Withdrawal.findOne({
              user: userId,
              receiptImage: relativePath
            }).lean();
            if (withdrawal) isAuthorized = true;
          }

          if (!isAuthorized) {
            const commission = await Commission.findOne({
              $and: [
                { $or: [{ sellerId: userId }, { buyerId: userId }] },
                { paymentReceipt: relativePath }
              ]
            }).lean();
            if (commission) isAuthorized = true;
          }
        } else if (folder === "documents") {
          isAuthorized = false;
        }
      }

      console.log("[FileAuthCheck]", {
        path: req.path,
        userId: userId || null,
        userRole: req.user?.role || null,
        isAdmin,
        isAuthorized,
        relativePath: `${folder}/${filename}`,
      });
      if (!userId && !isAdmin) {
        console.log("[FileAuthCheck] FAIL 401 — (!userId && !isAdmin) both true. userId:", userId, "isAdmin:", isAdmin);
        return sendErrorResponse(req, res, 401,
          "Unauthorized: No token provided",
          "تسجيل الدخول مطلوب",
          "يرجى تسجيل الدخول لعرض السند"
        );
      }

      if (!isAuthorized) {
        console.log("[FileAuthCheck] FAIL 403 — isAuthorized=false. userId:", userId, "isAdmin:", isAdmin, "userRole:", req.user?.role);
        return sendErrorResponse(req, res, 403,
          "غير مصرح لك بالوصول لهذا الملف.",
          "وصول مرفوض",
          "هذا السند خاص بمستخدم آخر"
        );
      }

      const { contentType, contentDisposition, filename: previewFilename } = resolveInlineFileHeaders(filePath);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", contentDisposition);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self';");
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      res.sendFile(filePath, { headers: { "Content-Disposition": contentDisposition, "X-Content-Type-Options": "nosniff" } });
    } catch (error) {
      console.error("File access error:", error);
      return sendErrorResponse(req, res, 500,
        "Internal server error",
        "خطأ في الخادم",
        "يرجى المحاولة مرة أخرى لاحقاً"
      );
    }
  }
);

export default router;
