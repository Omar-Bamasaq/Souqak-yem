import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  IMAGE_PROCESSING_LIMITS,
  processPublicImageVariants
} from "../services/publicImagePipeline.js";
import logger from "../lib/logger.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const watermarkPath = path.join(backendRoot, "src", "assets", "souqak-watermark.svg");
const SAFE_IMAGE_FAILURE_STAGES = new Set(["variant_generation", "variant_validation"]);
const SAFE_IMAGE_FAILURE_REASONS = new Set([
  "unsupported_format",
  "corrupt_or_unsupported",
  "dimensions_exceeded",
  "output_size_exceeded",
  "watermark_processing_failed",
  "output_collision",
  "required_variants_missing",
  "image_processing_failed"
]);

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

function getImageFailureReason(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("only jpeg") || message.includes("unsupported image format")) return "unsupported_format";
  if (message.includes("corrupt") || message.includes("invalid image")) return "corrupt_or_unsupported";
  if (message.includes("dimension") || message.includes("pixel limit")) return "dimensions_exceeded";
  if (message.includes("output size")) return "output_size_exceeded";
  if (message.includes("watermark")) return "watermark_processing_failed";
  if (message.includes("replace an existing")) return "output_collision";
  return "image_processing_failed";
}

function getSafeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{1,40}$/i.test(error.code)
    ? error.code
    : null;
}

function isAdCreationRequest(req) {
  return req.method === "POST" && req.baseUrl === "/api/ads" && req.path === "/";
}

function safeMetadataInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function getDimensionFailureDiagnostics(file) {
  const imageVariantsPresent = Boolean(
    file?.imageVariants && typeof file.imageVariants === "object" && !Array.isArray(file.imageVariants)
  );
  let pathMatchesUploadFullVariant = false;
  try {
    pathMatchesUploadFullVariant = Boolean(
      typeof file?.path === "string"
      && typeof file.destination === "string"
      && typeof file.imageVariants?.full === "string"
      && path.resolve(file.path) === path.resolve(file.destination, file.imageVariants.full)
    );
  } catch {
    pathMatchesUploadFullVariant = false;
  }

  let metadataRead = false;
  let inputDimensions = { width: null, height: null, pages: null, orientation: null };
  try {
    if (!file?.path) throw new Error("Image path is unavailable.");
    const metadata = await sharp(file.path, {
      failOn: "warning",
      limitInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels
    }).metadata();
    inputDimensions = {
      width: safeMetadataInteger(metadata.width),
      height: safeMetadataInteger(metadata.height),
      pages: safeMetadataInteger(metadata.pages),
      orientation: safeMetadataInteger(metadata.orientation)
    };
    metadataRead = true;
  } catch {
    metadataRead = false;
  }

  return {
    inputDimensions,
    metadataRead,
    imageVariantsPresent,
    pathMatchesUploadFullVariant,
    maxInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels,
    maxInputDimension: IMAGE_PROCESSING_LIMITS.maxInputDimension
  };
}

export default function processImages(_type = "ads") {
  return async (req, _res, next) => {
    req.imageProcessingErrors = [];

    for (const [index, file] of filesFromRequest(req).entries()) {
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
        const reason = getImageFailureReason(error);
        req.imageProcessingErrors.push({
          imageIndex: index + 1,
          stage: "variant_generation",
          code: getSafeErrorCode(error),
          reason,
          ...(reason === "dimensions_exceeded" && isAdCreationRequest(req)
            ? { diagnostics: await getDimensionFailureDiagnostics(file) }
            : {})
        });
      }
    }
    next();
  };
}

export function validateProcessedImages(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : [];
  const errors = Array.isArray(req.imageProcessingErrors) ? req.imageProcessingErrors : [];

  for (const [index, file] of files.entries()) {
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
        imageIndex: index + 1,
        stage: "variant_validation",
        code: "MISSING_VARIANTS",
        reason: "required_variants_missing"
      });
    }
  }

  if (errors.length > 0) {
    if (isAdCreationRequest(req)) {
      logger.warn({
        event: "ad_image_processing_failed",
        requestId: req.id || null,
        imageFailures: errors.slice(0, 10).map((failure, index) => {
          const reason = SAFE_IMAGE_FAILURE_REASONS.has(failure.reason)
            ? failure.reason
            : "image_processing_failed";
          const diagnostics = reason === "dimensions_exceeded" ? failure.diagnostics : null;
          return {
            imageIndex: Number.isInteger(failure.imageIndex) ? failure.imageIndex : index + 1,
            stage: SAFE_IMAGE_FAILURE_STAGES.has(failure.stage) ? failure.stage : "unknown",
            reason,
            code: typeof failure.code === "string" && /^[A-Z0-9_]{1,40}$/i.test(failure.code)
              ? failure.code
              : null,
            ...(diagnostics ? {
              inputDimensions: diagnostics.inputDimensions,
              metadataRead: Boolean(diagnostics.metadataRead),
              imageVariantsPresent: Boolean(diagnostics.imageVariantsPresent),
              pathMatchesUploadFullVariant: Boolean(diagnostics.pathMatchesUploadFullVariant),
              maxInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels,
              maxInputDimension: IMAGE_PROCESSING_LIMITS.maxInputDimension
            } : {})
          };
        })
      });
    }

    return res.status(422).json({
      error: "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور.",
      code: "IMAGE_PROCESSING_FAILED"
    });
  }

  next();
}
