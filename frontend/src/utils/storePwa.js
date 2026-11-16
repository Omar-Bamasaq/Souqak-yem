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

export function buildStorePwaLaunchUrl(
  storeId,
  { userAgent = "", origin = "https://apps.souqak-yem.com", installAttempt = false } = {}
) {
  const appUrl = buildStorePwaAppUrl(storeId, origin);
  if (!/Android/i.test(userAgent)) return appUrl;

  const target = new URL(appUrl);
  if (installAttempt) target.searchParams.set("pwaInstallAttempt", "1");
  const launchUrl = target.href;
  return `intent://${target.host}${target.pathname}${target.search}#Intent;scheme=${target.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(launchUrl)};end`;
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
  if (isAppleMobile) {
    return "على iPhone أو iPad، افتح الصفحة في Safari، ثم قائمة المشاركة واختر «إضافة إلى الشاشة الرئيسية». لا يدعم iOS بدء التثبيت برمجيًا.";
  }
  if (/Android/i.test(userAgent)) {
    return "إذا لم تظهر نافذة التثبيت، افتح قائمة Chrome (⋮) واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».";
  }
  return "إذا لم تظهر نافذة التثبيت، افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، إذا كان الخيار متاحًا.";
}

export function getStorePwaNotificationLink(
  notification,
  storePwaContext,
  expectedOrigin = "https://apps.souqak-yem.com"
) {
  const link = notification?.link || notification?.data?.url || "/notifications";
  const currentStoreId = String(storePwaContext?.storeId || "");
  const notificationStoreId = String(notification?.storeProfileId || notification?.data?.storeProfileId || "");
  const storePwaUrl = notification?.data?.storePwaUrl;

  if (!currentStoreId || !notificationStoreId) return link;
  if (!storePwaUrl) {
    const currentSlug = String(storePwaContext?.slug || "");
    if (notificationStoreId === currentStoreId
      && currentSlug
      && link.startsWith(`/store/${currentSlug}`)
      && (link.length === `/store/${currentSlug}`.length
        || ["/", "?", "#"].includes(link[`/store/${currentSlug}`.length]))) {
      return "/";
    }
    return link;
  }

  let target;
  try {
    target = new URL(storePwaUrl);
  } catch {
    return link;
  }

  let allowedOrigin;
  try {
    allowedOrigin = new URL(expectedOrigin).origin;
  } catch {
    return link;
  }

  if (!/^[a-f\d]{24}$/i.test(notificationStoreId)
    || target.protocol !== "https:"
    || target.origin !== allowedOrigin
    || target.pathname !== `/store/${notificationStoreId}/`
    || target.search
    || target.hash) {
    return link;
  }

  return notificationStoreId === currentStoreId ? "/" : target.href;
}
