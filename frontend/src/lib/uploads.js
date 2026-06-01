export function uploadsBase() {
  let envUrl = import.meta.env.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  // Ensure we don't have double /uploads
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}

export function uploadsUrl(filename, size = "full") {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  
  // Clean the filename: remove leading /uploads/ if it exists
  let cleanFilename = filename;
  if (filename.startsWith("/uploads/")) {
    cleanFilename = filename.replace("/uploads/", "");
  } else if (filename.startsWith("uploads/")) {
    cleanFilename = filename.replace("uploads/", "");
  }
  
  let finalFilename = cleanFilename;
  // Only apply thumb/med if not already there and not for categories
  if (!cleanFilename.includes("categories/")) {
    if (size === "thumb" && !cleanFilename.includes(".thumb.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".thumb.webp");
    } else if (size === "med" && !cleanFilename.includes(".med.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".med.webp");
    }
  }
  
  return `${uploadsBase()}/${finalFilename}`;
}

