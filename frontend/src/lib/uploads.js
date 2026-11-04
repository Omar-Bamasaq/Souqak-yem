function isGeneratedPublicImage(filename) {
  const clean = String(filename || "").replace(/\\/g, "/");
  return /(?:^|\/)(?:category-)?public-[a-z0-9-]+\.webp$/i.test(clean);
}

export function uploadsBase() {
  let envUrl = import.meta.env.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}

const SENSITIVE_KEYWORDS = ["receipts", "ids", "kyc", "documents"];

export function isSensitiveFilePath(filename) {
  if (!filename) {
    return false;
  }
  const clean = String(filename).replace(/\\/g, "/").toLowerCase();
  for (const kw of SENSITIVE_KEYWORDS) {
    const startsWith = clean.startsWith(kw + "/");
    const containsDir = clean.includes("/" + kw + "/");
    const equalsDir = clean === kw;
    if (startsWith || containsDir || equalsDir) {
      return true;
    }
  }
  return false;
}

export function uploadsUrl(filename, size = "full") {
  if (!filename) {
    return "";
  }
  if (/^https?:\/\//i.test(filename)) {
    try {
      if (isSensitiveFilePath(new URL(filename).pathname)) return "";
    } catch {
      return "";
    }
    return filename;
  }

  let cleanFilename = filename;
  if (filename.startsWith("/uploads/")) {
    cleanFilename = filename.replace("/uploads/", "");
  } else if (filename.startsWith("uploads/")) {
    cleanFilename = filename.replace("uploads/", "");
  }

  let finalFilename = cleanFilename;
  if (isGeneratedPublicImage(cleanFilename)) {
    if (size === "thumb" && !cleanFilename.includes(".thumb.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".thumb.webp");
    } else if (size === "med" && !cleanFilename.includes(".med.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".med.webp");
    }
  }

  const baseUrl = `${uploadsBase()}/${finalFilename}`;

  return isSensitiveFilePath(finalFilename) ? "" : baseUrl;
}
