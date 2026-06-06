import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Utility to process images using Sharp
 * @param {string} filePath - Original file path
 * @param {string} type - Image type (ads, avatar, ids, receipts)
 * @returns {Promise<string>} - New file path (WebP)
 */
export const processImage = async (filePath, type = "ads") => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`File not found for processing: ${filePath}`);
      return filePath;
    }
    
    const ext = path.extname(filePath);
    if (ext.toLowerCase() === ".pdf") return filePath; // Skip PDFs

    const newPath = filePath.replace(ext, ".webp");
    let width = 1200, height = 1200; // Increased max size slightly for quality

    if (type !== "ads") {
      width = 800;
      height = 800;
    }

    const image = sharp(filePath).rotate();
    
    // 1. Full Size (Optimized & Sanitized)
    await image
      .clone()
      .resize(width, height, {
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 6 }) // EFFORT 6 for better compression
      .toFile(newPath);
    console.log(`[ImageProcess] Created full size: ${newPath}`);

    // 2. Thumbnail (for small previews)
    const thumbPath = filePath.replace(ext, ".thumb.webp");
    try {
      await image
        .clone()
        .resize(300, 300, {
          fit: "cover",
          position: "center"
        })
        .webp({ quality: 70 })
        .toFile(thumbPath);
      console.log(`[ImageProcess] Created thumbnail: ${thumbPath}`);
    } catch (thumbErr) {
      console.error(`[ImageProcess] Thumbnail failed for ${filePath}:`, thumbErr);
    }

    // Delete original file if it's different from the new one
    if (filePath !== newPath) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting original file: ${filePath}`, err);
      });
    }

    return newPath;
  } catch (err) {
    console.error("Image processing error:", err);
    return filePath;
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${uuidv4()}${ext}`; // Use UUID for security
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]; // More strict, removed GIF
  if (!allowedTypes.includes(file.mimetype)) {
    const err = new Error("نوع الملف غير مدعوم. يرجى رفع صورة (JPG, PNG, WebP)");
    err.status = 400;
    return cb(err, false);
  }
  cb(null, true);
}

const commonOptions = {
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3MB limit
};

const receiptsDir = path.join(uploadDir, "receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const idsDir = path.join(uploadDir, "ids");
if (!fs.existsSync(idsDir)) {
  fs.mkdirSync(idsDir, { recursive: true });
}

function idFileFilter(req, file, cb) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("نوع الملف غير مدعوم. يرجى رفع صورة أو ملف PDF"), false);
  }
  cb(null, true);
}

export const uploadImages = multer({
  ...commonOptions,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 } // Allow up to 5MB and 10 files for ads
});

export const uploadAvatar = multer({
  ...commonOptions,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB for avatar
});

export const uploadReceipt = multer({
  ...commonOptions,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB for receipts
}).array("paymentReceipt", 5);

export const uploadIdDoc = multer({
  ...commonOptions,
  fileFilter: idFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});



const storageVerification = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = (file.fieldname === "idFrontImage" || file.fieldname === "idBackImage" || file.fieldname === "selfieImage") ? idsDir : receiptsDir;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "");
    const prefix = file.fieldname;
    cb(null, `${prefix}-${base}-${Date.now()}${ext}`);
  }
});

export const uploadVerificationDocs = multer({
  storage: storageVerification,
  fileFilter: idFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
  { name: "idFrontImage", maxCount: 1 }, 
  { name: "idBackImage", maxCount: 1 }, 
  { name: "selfieImage", maxCount: 1 }
]);





const logosDir = path.join(uploadDir, "logos");
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "");
    cb(null, `logo-${base}-${Date.now()}${ext}`);
  }
});

export const uploadBankLogo = multer({
  storage: storageLogo,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single("logo");

const commissionDir = receiptsDir;
const commissionImageDir = uploadDir;
const storageCommission = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === "adImage" ? commissionImageDir : commissionDir;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "");
    const prefix = file.fieldname === "adImage" ? "ad" : "receipt";
    cb(null, `${prefix}-${base}-${Date.now()}${ext}`);
  }
});

export const uploadCommissionDocs = multer({
  storage: storageCommission,
  fileFilter: idFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([{ name: "adImage", maxCount: 1 }, { name: "paymentReceipt", maxCount: 1 }]);
