import fs from "fs";
import path from "path";
import sharp from "sharp";

export const IMAGE_PROCESSING_LIMITS = Object.freeze({
  maxInputPixels: 40_000_000,
  maxInputDimension: 12_000,
  maxOutputBytes: 10 * 1024 * 1024,
  legacyOutputDimension: 3_000
});

export const PUBLIC_IMAGE_VARIANTS = Object.freeze({
  full: Object.freeze({ width: 1_200, height: 1_200, quality: 80, fit: "inside" }),
  med: Object.freeze({ width: 600, height: 600, quality: 70, fit: "inside" }),
  thumb: Object.freeze({ width: 300, height: 300, quality: 60, fit: "cover" })
});

export function publicImageVariantNames(baseName) {
  if (typeof baseName !== "string" || !/^[a-z0-9_-]+$/i.test(baseName)) {
    throw new Error("Invalid public image base name.");
  }
  return {
    full: `${baseName}.webp`,
    med: `${baseName}.med.webp`,
    thumb: `${baseName}.thumb.webp`
  };
}

export function shouldConvertCategoryRasterImage(filename, metadata) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  const expectedFormat = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp"
  }[extension];
  return Boolean(
    expectedFormat &&
    metadata?.format === expectedFormat &&
    (!metadata.pages || metadata.pages <= 1)
  );
}

export function identifyImageFormat(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";

  const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s|>)/i.test(text)) return "svg";
  return null;
}

export async function processPublicImageVariants({
  sourcePath,
  destination,
  baseName,
  maxInputPixels = IMAGE_PROCESSING_LIMITS.maxInputPixels,
  maxInputDimension = IMAGE_PROCESSING_LIMITS.maxInputDimension,
  watermarkForVariant
}) {
  const names = publicImageVariantNames(baseName);
  const outputs = Object.fromEntries(
    Object.entries(names).map(([variant, filename]) => [variant, path.join(destination, filename)])
  );
  let metadata;

  try {
    metadata = await sharp(sourcePath, {
      failOn: "warning",
      limitInputPixels: maxInputPixels
    }).metadata();
  } catch {
    throw new Error("Image is corrupt or unsupported.");
  }

  if (!["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("Only JPEG, PNG, and WebP images can use the public image pipeline.");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > maxInputDimension ||
    metadata.height > maxInputDimension ||
    metadata.width * metadata.height > maxInputPixels ||
    (metadata.pages && metadata.pages > 1)
  ) {
    throw new Error("Image dimensions exceed the allowed limit.");
  }

  await fs.promises.mkdir(destination, { recursive: true });
  for (const outputPath of Object.values(outputs)) {
    try {
      await fs.promises.access(outputPath);
      throw new Error("Refusing to replace an existing image variant.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const created = [];
  try {
    for (const [variant, settings] of Object.entries(PUBLIC_IMAGE_VARIANTS)) {
      const oriented = metadata.orientation >= 5 && metadata.orientation <= 8
        ? { width: metadata.height, height: metadata.width }
        : { width: metadata.width, height: metadata.height };
      const scale = settings.fit === "cover"
        ? Math.min(Math.max(settings.width / oriented.width, settings.height / oriented.height), 1)
        : Math.min(settings.width / oriented.width, settings.height / oriented.height, 1);
      const width = Math.max(1, Math.round(oriented.width * scale));
      const height = Math.max(1, Math.round(oriented.height * scale));
      const watermark = watermarkForVariant
        ? await watermarkForVariant({ variant, width, height })
        : null;
      const encoder = sharp(sourcePath, {
        failOn: "warning",
        limitInputPixels: maxInputPixels
      })
        .rotate()
        .resize(settings.width, settings.height, {
          fit: settings.fit,
          position: "centre",
          withoutEnlargement: true
        });

      if (watermark) {
        encoder.composite([{ input: watermark, gravity: "northeast" }]);
      }

      created.push(outputs[variant]);
      await encoder
        .webp({ quality: settings.quality, effort: 6, alphaQuality: 100 })
        .toFile(outputs[variant]);

      const stats = await fs.promises.stat(outputs[variant]);
      if (stats.size > IMAGE_PROCESSING_LIMITS.maxOutputBytes) {
        throw new Error("Processed image exceeds the allowed output size.");
      }
    }
  } catch (error) {
    const cleanupErrors = [];
    await Promise.all(created.map(async (outputPath) => {
      try {
        await fs.promises.unlink(outputPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") cleanupErrors.push(cleanupError);
      }
    }));
    if (cleanupErrors.length) {
      const cleanupErrorMessages = cleanupErrors.map((cleanupError) => cleanupError.message);
      if (error instanceof Error && Object.isExtensible(error)) {
        error.cleanupErrors = [
          ...(Array.isArray(error.cleanupErrors) ? error.cleanupErrors : []),
          ...cleanupErrorMessages
        ];
      }
      console.error("Partial public image variant cleanup failed.", {
        message: error instanceof Error ? error.message : String(error),
        cleanupErrors: cleanupErrorMessages
      });
    }
    throw error;
  }

  return {
    names,
    paths: outputs,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      hasAlpha: Boolean(metadata.hasAlpha),
      format: metadata.format
    }
  };
}
