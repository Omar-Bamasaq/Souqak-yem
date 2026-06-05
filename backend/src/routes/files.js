import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import auth from "../middleware/auth.js";
import Order from "../models/Order.js";
import VerificationRequest from "../models/VerificationRequest.js";
import Withdrawal from "../models/Withdrawal.js";
import PurchaseRequest from "../models/PurchaseRequest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");

const router = Router();

/**
 * Endpoint محمي لعرض الملفات الحساسة
 * يدعم المجلدات: ids, kyc, documents, receipts
 */
router.get("/:folder(ids|kyc|documents|receipts)/:filename", auth, async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    const sensitiveFolders = ["ids", "kyc", "documents", "receipts"];
    if (!sensitiveFolders.includes(folder)) {
      return res.status(400).json({ error: "Not a sensitive folder" });
    }

    const filePath = path.join(uploadDir, folder, filename);
    
    // التحقق من وجود الملف
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // منطق التحقق من الصلاحيات (Authorization)
    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      const relativePath = `${folder}/${filename}`;

      if (folder === "ids" || folder === "kyc") {
        // التحقق من ملكية الهوية
        const verif = await VerificationRequest.findOne({
          user: userId,
          $or: [
            { idFrontImage: relativePath },
            { idBackImage: relativePath },
            { selfieImage: relativePath }
          ]
        }).lean();
        if (verif) isAuthorized = true;

        // التحقق من طلبات السحب (Withdrawals)
        if (!isAuthorized) {
          const withdrawal = await Withdrawal.findOne({
            user: userId,
            "bankDetails.identityImage": relativePath
          }).lean();
          if (withdrawal) isAuthorized = true;
        }
      } else if (folder === "receipts") {
        // التحقق من ملكية الطلب (مشتري أو بائع)
        const order = await Order.findOne({
          $or: [{ buyer: userId }, { seller: userId }],
          $or: [
            { "paymentDetails.payments.receiptImage": relativePath },
            { "shippingDetails.shippingReceipt": relativePath }
          ]
        }).lean();
        if (order) isAuthorized = true;

        // التحقق من طلبات التمييز والتوثيق المدفوعة
        if (!isAuthorized) {
          const pr = await PurchaseRequest.findOne({
            user: userId,
            paymentReceipt: relativePath
          }).lean();
          if (pr) isAuthorized = true;
        }
      } else if (folder === "documents") {
        // أي منطق إضافي للمستندات العامة الحساسة
        // حالياً نكتفي بالأدمن أو نطلب ملكية خاصة إذا تم ربطها بموديل
        isAuthorized = false; // Default false for generic documents if not admin
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "غير مصرح لك بالوصول لهذا الملف." });
    }

    // إرسال الملف
    res.sendFile(filePath);
  } catch (error) {
    console.error("File access error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
