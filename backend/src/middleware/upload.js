import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const avatarsDir = path.join(uploadDir, "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

export const processImage = async (filePath, type = "ads") => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`File not found for processing: ${filePath}`);
      return filePath;
    }
    
    const ext = path.extname(filePath);
    if (ext.toLowerCase() === ".pdf") return filePath;

    const newPath = filePath.replace(ext, ".webp");
    let width = 1200, height = 1200;

    if (type !== "ads") {
      width = 800;
      height = 800;
    }

    const image = sharp(filePath).rotate();
    
    await image
      .clone()
      .resize(width, height, {
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(newPath);
    console.log(`[ImageProcess] Created full size: ${newPath}`);

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
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
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
  limits: { fileSize: 3 * 1024 * 1024 }
};

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

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
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

const storageIds = multer.diskStorage({
  destination: (req, file, cb) => cb(null, idsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  }
});

export const uploadIdDoc = multer({
  storage: storageIds,
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

const storageCommission = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === "adImage" ? uploadDir : receiptsDir;
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

const storageReceipts = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  }
});

export const uploadReceipt = multer({
  storage: storageReceipts,
  fileFilter: idFileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }
}).array("paymentReceipt", 5);
