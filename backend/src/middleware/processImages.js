import path from "path";
import fs from "fs";
import sharp from "sharp";

const uploadDir = path.join(process.cwd(), "uploads");

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

        const srcPath = path.join(f.destination, f.filename);
        const base = f.filename.replace(path.extname(f.filename), "");
        const webpName = `${base}.webp`;
        const webpPath = path.join(f.destination, webpName);
        
        try {
          // Determine max dimensions based on type
          const maxWidth = type === "ads" ? 1000 : 800;
          const maxHeight = type === "ads" ? 1000 : 800;

          // Process image: Resize, Convert to WebP, Optimize & Clean Metadata
          const image = sharp(srcPath).rotate();
          
          // 1. Full Size (Optimized & Sanitized)
          await image
            .clone()
            .resize(maxWidth, maxHeight, {
              fit: "inside",
              withoutEnlargement: true
            })
            .webp({ quality: 80, effort: 6 })
            .toFile(webpPath);

          // 2. Medium Size (for details)
          const medPath = path.join(f.destination, `${base}.med.webp`);
          await image
            .clone()
            .resize(600, 600, {
              fit: "inside",
              withoutEnlargement: true
            })
            .webp({ quality: 70, effort: 6 })
            .toFile(medPath);

          // 3. Thumbnail Size (for lists)
          const thumbPath = path.join(f.destination, `${base}.thumb.webp`);
          await image
            .clone()
            .resize(300, 300, {
              fit: "cover", // Thumbnails usually look better cropped
              position: "center"
            })
            .webp({ quality: 60, effort: 6 })
            .toFile(thumbPath);
            
          f.optimizedFilename = webpName;
          f.filename = webpName; // Update filename to the new one for downstream controllers

          // Delete original file if it was not already WebP
          if (path.extname(f.filename).toLowerCase() !== '.webp') {
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

