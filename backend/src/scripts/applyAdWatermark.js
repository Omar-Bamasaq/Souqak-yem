import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import Ad from "../models/Ad.js";

dotenv.config();

const uploadDir = path.join(process.cwd(), "uploads");
const logoPath = path.join(process.cwd(), "src", "assets", "souqak-watermark.svg");
const watermarkCache = new Map();

async function getWatermark(width) {
  const targetWidth = Math.max(180, Math.round(width * 0.42));
  if (!watermarkCache.has(targetWidth)) {
    const logo = await sharp(logoPath)
      .resize(targetWidth, null, { fit: "inside" })
      .png()
      .toBuffer();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}"><image href="data:image/png;base64,${logo.toString("base64")}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMax yMax meet" opacity="0.2"/></svg>`;
    watermarkCache.set(targetWidth, Buffer.from(svg));
  }
  return watermarkCache.get(targetWidth);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findOriginal(imageName) {
  const base = imageName.replace(/\.webp$/i, "");
  for (const extension of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = path.join(uploadDir, `${base}${extension}`);
    if (await fileExists(candidate)) return candidate;
  }
  return path.join(uploadDir, imageName);
}

async function processVariant(sourcePath, outputPath, width, height, watermark) {
  const temporaryPath = `${outputPath}.watermark.tmp`;
  await sharp(sourcePath)
    .rotate()
    .resize(width, height, { fit: width === 300 ? "cover" : "inside", withoutEnlargement: true, position: "center" })
    .composite([{ input: watermark, gravity: "southeast" }])
    .webp({ quality: width === 300 ? 60 : width === 600 ? 70 : 80, effort: 6 })
    .toFile(temporaryPath);
  await fs.rename(temporaryPath, outputPath);
}

async function main() {
  if (!(await fileExists(logoPath))) throw new Error(`Watermark logo not found: ${logoPath}`);
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/suqaq");
  const ads = await Ad.find({ images: { $exists: true, $ne: [] } }).select("images").lean();
  let processed = 0;
  let skipped = 0;

  for (const ad of ads) {
    for (const imageName of ad.images || []) {
      if (!/\.webp$/i.test(imageName)) {
        skipped++;
        continue;
      }
      const fullPath = path.join(uploadDir, imageName);
      if (!(await fileExists(fullPath))) {
        skipped++;
        continue;
      }
      const sourcePath = await findOriginal(imageName);
      const metadata = await sharp(sourcePath).metadata();
      const sourceWidth = metadata.width || 1000;
      const watermark = await getWatermark(Math.min(1000, sourceWidth));
      const base = imageName.replace(/\.webp$/i, "");
      await processVariant(sourcePath, fullPath, 1000, 1000, watermark);
      await processVariant(sourcePath, path.join(uploadDir, `${base}.med.webp`), 600, 600, watermark);
      await processVariant(sourcePath, path.join(uploadDir, `${base}.thumb.webp`), 300, 300, watermark);
      processed++;
    }
  }

  console.log(`Applied Souqak watermark to ${processed} ad images; skipped ${skipped}.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Ad watermark migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
