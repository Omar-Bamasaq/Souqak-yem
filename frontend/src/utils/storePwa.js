export function buildStorePwaAppUrl(storeId, origin = "https://apps.souqak-yem.com") {
  if (!/^[a-f\d]{24}$/i.test(String(storeId || ""))) {
    throw new Error("A valid store database ID is required.");
  }
  const appOrigin = new URL(origin);
  if (appOrigin.origin !== String(origin).replace(/\/+$/, "")) {
    throw new Error("Store PWA origin must not include a path.");
  }
  return new URL(`/store/${storeId}/`, appOrigin.origin).href;
}

export function buildStorePwaIconUrl(storeId, size, apiBase = "/api") {
  if (!/^[a-f\d]{24}$/i.test(String(storeId || "")) || ![192, 512].includes(size)) {
    throw new Error("A valid store ID and icon size are required.");
  }
  const base = String(apiBase || "/api").replace(/\/+$/, "");
  const normalizedBase = base.endsWith("/api") ? base : `${base}/api`;
  return `${normalizedBase}/stores/by-id/${encodeURIComponent(storeId)}/pwa-icon/${size}.png`;
}

export function getStorePwaInstallInstructions({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1);
  return isAppleMobile
    ? "على iPhone أو iPad، افتح قائمة المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية». لا يدعم iOS بدء التثبيت برمجيًا."
    : "إذا لم يظهر خيار التثبيت، افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، إذا كان الخيار متاحًا.";
}
