import path from "path";

const PUBLIC_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".svg"
]);

export default function publicUploads(req, res, next) {
  const extension = path.posix.extname(req.path.toLowerCase());
  if (!PUBLIC_IMAGE_EXTENSIONS.has(extension)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  if (extension === ".svg") {
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
  }
  next();
}
