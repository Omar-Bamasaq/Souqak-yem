import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const watermarkPath = path.join(backendRoot, "src", "assets", "souqak-watermark.svg");

async function createWatermark(width) {
  if (!fs.existsSync(watermarkPath)) {
    throw new Error(`Watermark logo not found: ${watermarkPath}`);
  }
  const logoWidth = Math.max(60, Math.min(160, Math.round(width * 0.16)));
  const logo = await sharp(watermarkPath)
    .resize(logoWidth, null, { fit: "inside" })
    .png()
    .toBuffer();
  const logoData = logo.toString("base64");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${logoWidth}" height="${Math.round(logoWidth * 0.36)}"><image href="data:image/png;base64,${logoData}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMax yMin meet" opacity="0.72"/></svg>`);
}

export default function processImages(type = "ads") {
  return async (req, res, next) => {
    try {
      req.imageProcessingErrors = [];
      // Support single file or multiple files
      const files = [];
      if (req.file) files.push(req.file);
      if (req.files) {
        if (Array.isArray(req.files)) {
          files.push(...req.files);
        } else {
          // Object format for fields
          Object.values(req.files).forEach(fieldFiles => {
            files.push(...fieldFiles);
          });
        }
      }

      for (const f of files) {
        // Skip if it's not an image (like PDF in ID docs)
        if (path.extname(f.filename).toLowerCase() === '.pdf') {
          f.optimizedFilename = f.filename;
          continue;
        }

        const originalFilename = f.filename;
        const srcPath = path.join(f.destination, originalFilename);
        const base = originalFilename.replace(path.extname(originalFilename), "");
        const webpName = `${base}.webp`;
        const webpPath = path.join(f.destination, webpName);
        
        try {
          // Determine max dimensions based on type
          const maxWidth = type === "ads" ? 1000 : 800;
          const maxHeight = type === "ads" ? 1000 : 800;

          // Process image: Resize, Convert to WebP, Optimize & Clean Metadata
          const image = sharp(srcPath).rotate();
          const metadata = await image.metadata();
          const containSize = (width, height) => {
            const scale = Math.min(width / (metadata.width || width), height / (metadata.height || height), 1);
            return {
              width: Math.max(1, Math.round((metadata.width || width) * scale)),
              height: Math.max(1, Math.round((metadata.height || height) * scale))
            };
          };
          const fullSize = containSize(maxWidth, maxHeight);
          const medSize = containSize(600, 600);
          
          // 1. Full Size (Optimized & Sanitized)
          const fullWatermark = await createWatermark(fullSize.width, fullSize.height);
          await image
            .clone()
            .resize(maxWidth, maxHeight, {
              fit: "inside",
              withoutEnlargement: true
            })
            .composite([{ input: fullWatermark, gravity: "northeast" }])
            .webp({ quality: 80, effort: 6 })
            .toFile(webpPath);

          // 2. Medium Size (for details)
          const medPath = path.join(f.destination, `${base}.med.webp`);
          const medWatermark = await createWatermark(medSize.width, medSize.height);
          await image
            .clone()
            .resize(600, 600, {
              fit: "inside",
              withoutEnlargement: true
            })
            .composite([{ input: medWatermark, gravity: "northeast" }])
            .webp({ quality: 70, effort: 6 })
            .toFile(medPath);

          // 3. Thumbnail Size (for lists)
          const thumbPath = path.join(f.destination, `${base}.thumb.webp`);
          const thumbWatermark = await createWatermark(300, 300);
          await image
            .clone()
            .resize(300, 300, {
              fit: "cover", // Thumbnails usually look better cropped
              position: "center"
            })
            .composite([{ input: thumbWatermark, gravity: "northeast" }])
            .webp({ quality: 60, effort: 6 })
            .toFile(thumbPath);
            
          f.optimizedFilename = webpName;
          f.filename = webpName; // Update filename to the new one for downstream controllers

          // Delete the unprocessed source after all variants are written.
          if (path.extname(originalFilename).toLowerCase() !== '.webp') {
            try {
              if (fs.existsSync(srcPath)) {
                fs.unlinkSync(srcPath);
              }
            } catch (unlinkErr) {
              console.error("Failed to delete original image:", unlinkErr);
            }
          }
        } catch (err) {
          console.error("Image processing error for file:", f.filename, err);
          req.imageProcessingErrors.push({
            filename: originalFilename,
            message: err.message || "Image processing failed"
          });
        }
      }
    } catch (err) {
      console.error("Global image processing middleware error:", err);
      req.imageProcessingErrors = [{
        filename: null,
        message: err.message || "Image processing failed"
      }];
    }
    next();
  };
}

export function validateProcessedImages(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : [];
  const errors = Array.isArray(req.imageProcessingErrors) ? req.imageProcessingErrors : [];

  for (const file of files) {
    const optimizedFilename = file.optimizedFilename;
    const optimizedPath = optimizedFilename ? path.join(file.destination, optimizedFilename) : null;
    const base = optimizedFilename ? optimizedFilename.replace(/\.webp$/i, "") : null;
    const thumbnailPath = base ? path.join(file.destination, `${base}.thumb.webp`) : null;

    if (!optimizedFilename || !optimizedPath || !fs.existsSync(optimizedPath) || !thumbnailPath || !fs.existsSync(thumbnailPath)) {
      errors.push({
        filename: file.filename || null,
        message: "Image processing did not create the required thumbnail"
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

