import path from "path";

export function resolveInlineFileHeaders(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const imageMimeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp"
  };

  if (imageMimeMap[ext]) {
    return {
      contentType: imageMimeMap[ext],
      contentDisposition: "inline; filename*=UTF-8''" + encodeURIComponent(path.basename(filePath)),
      filename: path.basename(filePath)
    };
  }

  if (ext === ".pdf") {
    return {
      contentType: "application/pdf",
      contentDisposition: "inline; filename*=UTF-8''" + encodeURIComponent(path.basename(filePath)),
      filename: path.basename(filePath)
    };
  }

  return {
    contentType: "application/octet-stream",
    contentDisposition: "attachment; filename*=UTF-8''" + encodeURIComponent(path.basename(filePath)),
    filename: path.basename(filePath)
  };
}
