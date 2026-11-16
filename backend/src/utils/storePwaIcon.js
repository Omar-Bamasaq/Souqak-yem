import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createFallbackSvg(storeName, size) {
  const initial = escapeSvgText(Array.from(String(storeName || "متجر").trim())[0] || "م");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f766e"/><path d="M96 210 132 112h248l36 98v42H96z" fill="#ecfdf5"/><path d="M96 210h320v46a32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32 32 32 0 0 1-32 32 32 32 0 0 1-32-32z" fill="#5eead4"/><path d="M128 288h256v128H128z" fill="#fff"/><path d="M166 324h76v92h-76zM270 324h76v64h-76z" fill="#99f6e4"/><text x="256" y="490" text-anchor="middle" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff">${initial}</text></svg>`;
}

export async function createStorePwaIcon(store, size) {
  let iconSource;
  if (store.logo) {
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const logoPath = path.resolve(process.cwd(), store.logo);
    if (logoPath.startsWith(`${uploadsRoot}${path.sep}`)) {
      try {
        iconSource = await fs.readFile(logoPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  if (!iconSource) iconSource = Buffer.from(createFallbackSvg(store.storeName, size));
  return sharp(iconSource)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
}
