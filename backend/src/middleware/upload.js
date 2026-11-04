import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { privateMessageUploadsDirectory } from "../config/uploadPaths.js";
import {
  IMAGE_PROCESSING_LIMITS,
  publicImageVariantNames,
  processPublicImageVariants
} from "../services/publicImagePipeline.js";
import {
  cleanupRequestUploadStagingDirectory,
  createRequestUploadStagingDirectory
} from "../services/requestUploadStaging.js";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const avatarsDir = path.join(uploadDir, "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const receiptsDir = path.join(uploadDir, "receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const idsDir = path.join(uploadDir, "ids");
if (!fs.existsSync(idsDir)) {
  fs.mkdirSync(idsDir, { recursive: true });
}

const logosDir = path.join(uploadDir, "logos");
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_PIXELS = IMAGE_PROCESSING_LIMITS.maxInputPixels;
const MAX_IMAGE_DIMENSION = IMAGE_PROCESSING_LIMITS.maxInputDimension;
const OUTPUT_IMAGE_DIMENSION = IMAGE_PROCESSING_LIMITS.legacyOutputDimension;
const MAX_IMAGE_OUTPUT_BYTES = IMAGE_PROCESSING_LIMITS.maxOutputBytes;

function uploadError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function filesFromRequest(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return Object.values(req.files).flat();
  }
  return [];
}

function validateUploadMetadata(file, mode, maxInputPixels, maxInputDimension) {
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  const isPdf = mode === "pdf" || (mode === "image-or-pdf" && extension === ".pdf");

  if (isPdf) {
    if (extension !== ".pdf" || file.mimetype !== "application/pdf") {
      throw uploadError("نوع المستند غير مدعوم. يرجى رفع ملف PDF صالح.");
    }
    return "pdf";
  }

  if (!IMAGE_EXTENSIONS.has(extension) || !IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw uploadError("نوع الملف غير مدعوم. يرجى رفع صورة JPG أو PNG أو WebP.");
  }
  return "image";
}

async function validatePdf(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || header.toString("ascii") !== "%PDF-") {
      throw uploadError("ملف PDF تالف أو غير صالح.");
    }
  } finally {
    await handle.close();
  }
}

async function encodeSafeImage(file, outputPath, maxInputPixels, maxInputDimension) {
  let metadata;
  try {
    metadata = await sharp(file.path, {
      failOn: "warning",
      limitInputPixels: maxInputPixels
    }).metadata();
  } catch {
    throw uploadError("الصورة تالفة أو غير مدعومة.");
  }
  if (!["jpeg", "png", "webp"].includes(metadata.format)) {
    throw uploadError("محتوى الملف ليس صورة JPG أو PNG أو WebP صالحة.");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > maxInputDimension ||
    metadata.height > maxInputDimension ||
    metadata.width * metadata.height > maxInputPixels ||
    (metadata.pages && metadata.pages > 1)
  ) {
    throw uploadError("أبعاد الصورة تتجاوز الحد المسموح.");
  }

  const hasAlpha = Boolean(metadata.hasAlpha);
  const extension = hasAlpha ? ".png" : ".jpg";
  const outputMimeType = hasAlpha ? "image/png" : "image/jpeg";
  const encoder = sharp(file.path, {
    failOn: "warning",
    limitInputPixels: maxInputPixels
  })
    .rotate()
    .resize(OUTPUT_IMAGE_DIMENSION, OUTPUT_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true
    });

  try {
    if (hasAlpha) {
      await encoder.png({ compressionLevel: 9 }).toFile(outputPath);
    } else {
      await encoder.jpeg({ quality: 88, mozjpeg: true }).toFile(outputPath);
    }
  } catch {
    throw uploadError("تعذر قراءة الصورة أو تجهيزها بأمان.");
  }

  return { extension, mimeType: outputMimeType };
}

async function removeFiles(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const errors = [];
  for (const filePath of uniquePaths) {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") errors.push(error);
    }
  }
  return errors;
}

function attachCleanupErrors(primaryError, cleanupErrors) {
  if (cleanupErrors.length) {
    const messages = cleanupErrors.map((error) => error.message);
    if (primaryError instanceof Error && Object.isExtensible(primaryError)) {
      primaryError.cleanupErrors = messages;
    }
    console.error("Upload cleanup failed after an upload error.", {
      message: primaryError instanceof Error ? primaryError.message : String(primaryError),
      cleanupErrors: messages
    });
  }
}

function logSuccessfulUploadCleanupErrors(cleanupErrors) {
  if (cleanupErrors.length) {
    console.error("Upload succeeded, but request staging cleanup failed.", {
      cleanupErrors: cleanupErrors.map((error) => error.message)
    });
  }
}

export function createSafeUpload({
  destinationForFile,
  limits = {},
  modeForFile = () => "image",
  publicImageVariants = false,
  publicImageVariantsForFile,
  cleanupStagingDirectory = cleanupRequestUploadStagingDirectory,
  temporaryDirectory = os.tmpdir(),
  maxInputPixels = MAX_IMAGE_PIXELS,
  maxInputDimension = MAX_IMAGE_DIMENSION
}) {
  const stagingRoot = path.resolve(temporaryDirectory);
  const stagingPrefix = "souqak-upload-";
  const storage = multer.diskStorage({
    destination: (req, _file, callback) => callback(null, req.uploadStagingDirectory),
    filename: (_req, _file, callback) => callback(null, `${uuidv4()}.upload`)
  });
  const parser = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 10,
      ...limits
    },
    fileFilter: (req, file, callback) => {
      try {
        const mode = modeForFile(file, req);
        const extension = path.extname(String(file.originalname || "")).toLowerCase();
        const allowed = mode === "image"
          ? IMAGE_EXTENSIONS.has(extension) && IMAGE_MIME_TYPES.has(file.mimetype)
          : mode === "pdf"
            ? extension === ".pdf" && file.mimetype === "application/pdf"
            : mode === "image-or-pdf"
              ? (IMAGE_EXTENSIONS.has(extension) && IMAGE_MIME_TYPES.has(file.mimetype))
                || (extension === ".pdf" && file.mimetype === "application/pdf")
              : false;
        if (!allowed) {
          return callback(uploadError(
            mode === "pdf"
              ? "نوع المستند غير مدعوم. يرجى رفع ملف PDF صالح."
              : "نوع الملف غير مدعوم. يرجى رفع صورة JPG أو PNG أو WebP."
          ));
        }
        callback(null, true);
      } catch (error) {
        callback(error);
      }
    }
  });

  const wrap = (method, ...args) => {
    const parseRequest = parser[method](...args);
    const middleware = (req, res, next) => {
      void createRequestUploadStagingDirectory(stagingRoot, stagingPrefix).then((requestDirectory) => {
        req.uploadStagingDirectory = requestDirectory;
        parseRequest(req, res, (parseError) => {
        const uploadedFiles = filesFromRequest(req);
        if (parseError) {
          const error = parseError.code === "LIMIT_FILE_SIZE"
            ? uploadError("حجم الملف يتجاوز الحد المسموح.", 413)
            : parseError instanceof multer.MulterError
              ? uploadError("بيانات رفع الملفات غير صالحة.", 400)
              : parseError;
          void (async () => {
            const cleanupErrors = await removeFiles(uploadedFiles.map((file) => file.path));
            try {
              await cleanupStagingDirectory(requestDirectory, stagingRoot, stagingPrefix);
            } catch (cleanupError) {
              cleanupErrors.push(cleanupError);
            }
            attachCleanupErrors(error, cleanupErrors);
            next(error);
          })();
          return;
        }

        const generatedPaths = [];
        const temporaryPaths = uploadedFiles.map((file) => file.path);
        (async () => {
          for (const file of uploadedFiles) {
            const mode = validateUploadMetadata(file, modeForFile(file, req), maxInputPixels, maxInputDimension);
            const createPublicVariants = mode === "image" && (
              publicImageVariantsForFile
                ? publicImageVariantsForFile(file, req)
                : publicImageVariants
            );
            const destination = path.resolve(destinationForFile(file, req));
            await fs.promises.mkdir(destination, { recursive: true });

            if (mode === "pdf") await validatePdf(file);

            let imageMetadata = null;
            if (mode === "image") {
              try {
                imageMetadata = await sharp(file.path, {
                  failOn: "warning",
                  limitInputPixels: maxInputPixels
                }).metadata();
              } catch {
                throw uploadError("الصورة تالفة أو غير مدعومة.");
              }
            }
            const extension = mode === "pdf"
              ? ".pdf"
              : createPublicVariants
                ? ".webp"
                : imageMetadata.hasAlpha
                ? ".png"
                : ".jpg";
            const baseName = createPublicVariants ? `public-${uuidv4()}` : uuidv4();
            const filename = `${baseName}${extension}`;
            const outputPath = path.join(destination, filename);

            let mimeType;
            if (mode === "pdf") {
              generatedPaths.push(outputPath);
              await fs.promises.copyFile(file.path, outputPath);
              mimeType = "application/pdf";
            } else if (createPublicVariants) {
              let variants;
              const variantNames = publicImageVariantNames(baseName);
              generatedPaths.push(...Object.values(variantNames).map((name) => path.join(destination, name)));
              try {
                variants = await processPublicImageVariants({
                  sourcePath: file.path,
                  destination,
                  baseName,
                  maxInputPixels,
                  maxInputDimension
                });
              } catch (error) {
                throw uploadError(error.message || "تعذر تجهيز الصورة بأمان.");
              }
              file.imageVariants = {
                full: variants.names.full,
                med: variants.names.med,
                thumb: variants.names.thumb
              };
              mimeType = "image/webp";
            } else {
              generatedPaths.push(outputPath);
              const encoded = await encodeSafeImage(file, outputPath, maxInputPixels, maxInputDimension);
              mimeType = encoded.mimeType;
              if (encoded.extension !== extension) {
                throw uploadError("تعذر تجهيز الصورة بأمان.");
              }
            }

            const stats = await fs.promises.stat(outputPath);
            if (mode === "image" && stats.size > MAX_IMAGE_OUTPUT_BYTES) {
              throw uploadError("حجم الصورة بعد المعالجة يتجاوز الحد المسموح.", 413);
            }
            file.destination = destination;
            file.filename = filename;
            file.path = outputPath;
            file.size = stats.size;
            file.mimetype = mimeType;
          }

          const cleanupErrors = await removeFiles(temporaryPaths);
          try {
            await cleanupStagingDirectory(requestDirectory, stagingRoot, stagingPrefix);
          } catch (cleanupError) {
            cleanupErrors.push(cleanupError);
          }
          logSuccessfulUploadCleanupErrors(cleanupErrors);
        })().then(
          () => next(),
          async (error) => {
            const cleanupErrors = await removeFiles(generatedPaths);
            try {
              await cleanupStagingDirectory(requestDirectory, stagingRoot, stagingPrefix);
            } catch (cleanupError) {
              cleanupErrors.push(cleanupError);
            }
            attachCleanupErrors(error, cleanupErrors);
            next(error);
          }
        );
        });
      }).catch(next);
    };
    middleware.uploadMethod = method;
    middleware.uploadField = args[0];
    middleware.maxCount = args[1];
    middleware.producesPublicVariants = publicImageVariants || Boolean(publicImageVariantsForFile);
    return middleware;
  };

  const uploader = {
    single: (fieldName) => wrap("single", fieldName),
    array: (fieldName, maxCount) => wrap("array", fieldName, maxCount),
    fields: (fields) => wrap("fields", fields)
  };
  uploader.producesPublicVariants = publicImageVariants || Boolean(publicImageVariantsForFile);
  return uploader;
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

const imageOnlyMode = () => "image";
const imageOrPdfMode = () => "image-or-pdf";

export const uploadImages = createSafeUpload({
  destinationForFile: () => uploadDir,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  modeForFile: imageOnlyMode,
  publicImageVariants: true
});

export const uploadMessageImages = createSafeUpload({
  destinationForFile: () => privateMessageUploadsDirectory,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  modeForFile: imageOnlyMode
});

export const uploadAvatar = createSafeUpload({
  destinationForFile: () => avatarsDir,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  modeForFile: imageOnlyMode,
  publicImageVariants: true
});

export const uploadIdDoc = createSafeUpload({
  destinationForFile: () => idsDir,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  modeForFile: imageOrPdfMode
});

export const uploadVerificationDocs = createSafeUpload({
  destinationForFile: () => idsDir,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  modeForFile: imageOrPdfMode
}).fields([
  { name: "idFrontImage", maxCount: 1 }, 
  { name: "idBackImage", maxCount: 1 }, 
  { name: "selfieImage", maxCount: 1 }
]);

export const uploadBankLogo = createSafeUpload({
  destinationForFile: () => logosDir,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  modeForFile: imageOnlyMode,
  publicImageVariants: true
}).single("logo");

export const uploadWalletServiceCategoryImage = createSafeUpload({
  destinationForFile: () => logosDir,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  modeForFile: imageOnlyMode,
  publicImageVariants: true
}).single("image");

export const uploadCommissionDocs = createSafeUpload({
  destinationForFile: (file) => file.fieldname === "adImage" ? uploadDir : receiptsDir,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  modeForFile: (file) => file.fieldname === "paymentReceipt" ? "image-or-pdf" : "image",
  publicImageVariantsForFile: (file) => file.fieldname === "adImage"
}).fields([{ name: "adImage", maxCount: 1 }, { name: "paymentReceipt", maxCount: 1 }]);

export const uploadReceipt = createSafeUpload({
  destinationForFile: () => receiptsDir,
  limits: { fileSize: 4 * 1024 * 1024, files: 5 },
  modeForFile: imageOrPdfMode
}).array("paymentReceipt", 5);

export const uploadWalletServiceReceipt = createSafeUpload({
  destinationForFile: () => receiptsDir,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  modeForFile: imageOrPdfMode
}).single("paymentReceipt");

export const uploadStoreOrderReceipt = createSafeUpload({
  destinationForFile: () => receiptsDir,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  modeForFile: imageOnlyMode
}).single("paymentReceipt");
