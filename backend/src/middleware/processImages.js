import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  IMAGE_PROCESSING_LIMITS,
  processPublicImageVariants
} from "../services/publicImagePipeline.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const watermarkPath = path.join(backendRoot, "src", "assets", "souqak-watermark.svg");

async function createWatermark(width) {
  if (!fs.existsSync(watermarkPath)) {
    throw new Error("Watermark logo is unavailable.");
  }
  const logoWidth = Math.max(60, Math.min(160, Math.round(width * 0.16)));
  const logo = await sharp(watermarkPath)
    .resize(logoWidth, null, { fit: "inside" })
    .png()
    .toBuffer();
  const logoData = logo.toString("base64");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${logoWidth}" height="${Math.round(logoWidth * 0.36)}"><image href="data:image/png;base64,${logoData}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMax yMin meet" opacity="0.72"/></svg>`
  );
}

function filesFromRequest(req) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((fieldFiles) => files.push(...fieldFiles));
  }
  return files;
}

export default function processImages(_type = "ads") {
  return async (req, _res, next) => {
    req.imageProcessingErrors = [];

    for (const file of filesFromRequest(req)) {
      if (path.extname(file.filename).toLowerCase() === ".pdf") continue;

      const oldVariantPaths = file.imageVariants
        ? Object.values(file.imageVariants).map((filename) => path.join(file.destination, filename))
        : [file.path];
      try {
        const variants = await processPublicImageVariants({
          sourcePath: file.path,
          destination: file.destination,
          baseName: `public-${uuidv4()}`,
          maxInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels,
          maxInputDimension: IMAGE_PROCESSING_LIMITS.maxInputDimension,
          watermarkForVariant: ({ width }) => createWatermark(width)
        });

        const newPaths = new Set(Object.values(variants.paths));
        const cleanupErrors = [];
        for (const oldPath of oldVariantPaths) {
          if (!newPaths.has(oldPath)) {
            try {
              await fs.promises.unlink(oldPath);
            } catch (error) {
              if (error.code !== "ENOENT") cleanupErrors.push(error);
            }
          }
        }

        if (cleanupErrors.length > 0) {
          console.error("Image processing succeeded, but old variant cleanup failed.", {
            filename: file.filename || null,
            errors: cleanupErrors.map((error) => error.message)
          });
        }

        file.filename = variants.names.full;
        file.optimizedFilename = variants.names.full;
        file.path = variants.paths.full;
        file.size = (await fs.promises.stat(file.path)).size;
        file.mimetype = "image/webp";
        file.imageVariants = {
          full: variants.names.full,
          med: variants.names.med,
          thumb: variants.names.thumb
        };
      } catch (error) {
        req.imageProcessingErrors.push({
          filename: file.filename || null,
          message: error.message || "Image processing failed"
        });
      }
    }
    next();
  };
}

export function validateProcessedImages(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : [];
  const errors = Array.isArray(req.imageProcessingErrors) ? req.imageProcessingErrors : [];

  for (const file of files) {
    const variants = file.imageVariants;
    const variantsExist = variants
      && ["full", "med", "thumb"].every((variant) => {
        const filename = variants[variant];
        return filename
          && path.basename(filename) === filename
          && fs.existsSync(path.join(file.destination, filename));
      });

    if (!variantsExist) {
      errors.push({
        filename: file.filename || null,
        message: "Image processing did not create all required variants."
      });
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      error: "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور.",
      code: "IMAGE_PROCESSING_FAILED"
    });
  }

  next();
}
