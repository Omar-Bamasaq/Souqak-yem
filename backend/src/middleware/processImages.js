import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const watermarkPath = path.join(backendRoot, "src", "assets", "souqak-watermark.png");

async function createWatermark(width) {
  if (!fs.existsSync(watermarkPath)) {
    throw new Error(`Watermark logo not found: ${watermarkPath}`);
  }
  const logo = await sharp(watermarkPath)
    .resize(Math.max(180, Math.round(width * 0.42)), null, { fit: "inside" })
    .png()
    .toBuffer();
  const logoData = logo.toString("base64");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}"><image href="data:image/png;base64,${logoData}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMax yMax meet" opacity="0.2"/></svg>`);
}

export default function processImages(type = "ads") {
  return async (req, res, next) => {
    try {
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
          const watermark = await createWatermark(Math.min(maxWidth, metadata.width || maxWidth));
          const addWatermark = (pipeline) => watermark
            ? pipeline.composite([{ input: watermark, gravity: "southeast" }])
            : pipeline;
          
          // 1. Full Size (Optimized & Sanitized)
          await addWatermark(image
            .clone()
            .resize(maxWidth, maxHeight, {
              fit: "inside",
              withoutEnlargement: true
            }))
            .webp({ quality: 80, effort: 6 })
            .toFile(webpPath);

          // 2. Medium Size (for details)
          const medPath = path.join(f.destination, `${base}.med.webp`);
          await addWatermark(image
            .clone()
            .resize(600, 600, {
              fit: "inside",
              withoutEnlargement: true
            }))
            .webp({ quality: 70, effort: 6 })
            .toFile(medPath);

          // 3. Thumbnail Size (for lists)
          const thumbPath = path.join(f.destination, `${base}.thumb.webp`);
          await addWatermark(image
            .clone()
            .resize(300, 300, {
              fit: "cover", // Thumbnails usually look better cropped
              position: "center"
            }))
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
          f.optimizedFilename = f.filename;
        }
      }
    } catch (err) {
      console.error("Global image processing middleware error:", err);
    }
    next();
  };
}

