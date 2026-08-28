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

export function getAuthAccessToken() {
  try {
    if (typeof window === "undefined") return null;

    try {
      const cm = document.cookie.match(/(?:^|; )(?:token|accessToken|jwt)=([^;]*)/);
      if (cm) {
        const v = decodeURIComponent(cm[1]).trim();
        if (v && v.length > 20) {
          return v;
        }
      }
    } catch (e) {
      console.warn("[Uploads] cookie token parse error:", e.message);
    }

    const keys = ["token", "accessToken", "access_token", "jwt"];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!raw) continue;
        const str = String(raw).trim();
        if (!str) continue;
        if (str.startsWith('"') && str.endsWith('"')) {
          const v = str.slice(1, -1);
          if (v.length > 20) {
            return v;
          }
        }
        if (str.startsWith("{") || str.startsWith("[")) {
          try {
            const parsed = JSON.parse(str);
            const t = (parsed.token || parsed.accessToken || parsed.access_token || parsed.jwt || "") || null;
            if (t && String(t).length > 20) {
              return String(t);
            }
          } catch (_parseErr) {
            continue;
          }
          continue;
        }
        if (str.length > 20) {
          return str;
        }
      } catch (_err) {}
    }
    return null;
  } catch (e) {
    console.error("[Uploads] getAuthAccessToken unexpected exception:", e.message);
    return null;
  }
}

export function uploadsUrl(filename, size = "full") {
  if (!filename) {
    return "";
  }
  if (filename.startsWith("http")) {
    return filename;
  }

  let cleanFilename = filename;
  if (filename.startsWith("/uploads/")) {
    cleanFilename = filename.replace("/uploads/", "");
  } else if (filename.startsWith("uploads/")) {
    cleanFilename = filename.replace("uploads/", "");
  }

  let finalFilename = cleanFilename;
  if (!cleanFilename.includes("categories/") && !cleanFilename.includes("category-")) {
    if (size === "thumb" && !cleanFilename.includes(".thumb.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".thumb.webp");
    } else if (size === "med" && !cleanFilename.includes(".med.")) {
      finalFilename = cleanFilename.replace(/\.(webp|jpg|jpeg|png)$/i, ".med.webp");
    }
  }

  const baseUrl = `${uploadsBase()}/${finalFilename}`;

  const sensitive = isSensitiveFilePath(finalFilename);
  if (!sensitive) {
    return baseUrl;
  }

  const token = getAuthAccessToken();
  if (!token) {
    console.warn("[Uploads] uploadsUrl: SENSITIVE FILE but NO TOKEN available → returning baseUrl WITHOUT access_token (will get 401!)");
    return baseUrl;
  }
  const sep = baseUrl.includes("?") ? "&" : "?";
  const final = `${baseUrl}${sep}access_token=${encodeURIComponent(token)}`;
  return final;
}
