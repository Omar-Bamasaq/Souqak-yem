export const STORE_PWA_INSTALL_GUIDE_DELAY_MS = 8_000;
export const STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS = 7 * 24 * 60 * 60 * 1_000;

const STORE_TYPES_WITH_PWA = new Set(["store", "family-production"]);

export function getStorePwaInstallGuidePlatform({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0
} = {}) {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1)) return "iphone";
  return "android";
}

export function hasStorePwaInstallAttempt(search = "") {
  return new URLSearchParams(search).get("pwaInstallAttempt") === "1";
}

export function shouldRequestStorePwaInstallGuide(search = "") {
  const params = new URLSearchParams(search);
  return params.get("pwaInstallAttempt") === "1"
    && params.get("pwaInstallGuided") !== "1";
}

function markStorePwaInstallGuidanceShown(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.searchParams.get("pwaInstallAttempt") !== "1") return url;
  parsedUrl.searchParams.set("pwaInstallGuided", "1");
  return parsedUrl.href;
}

function markIntentAndFallbackGuided(url) {
  const intentMarker = "#Intent;";
  const markerIndex = url.indexOf(intentMarker);
  if (markerIndex === -1) return markStorePwaInstallGuidanceShown(url);

  const intentTarget = markStorePwaInstallGuidanceShown(url.slice(0, markerIndex));
  const intentOptions = url.slice(markerIndex + intentMarker.length).split(";");
  const fallbackPrefix = "S.browser_fallback_url=";
  const fallbackIndex = intentOptions.findIndex((option) => option.startsWith(fallbackPrefix));
  if (fallbackIndex !== -1) {
    const fallbackUrl = decodeURIComponent(intentOptions[fallbackIndex].slice(fallbackPrefix.length));
    intentOptions[fallbackIndex] = `${fallbackPrefix}${encodeURIComponent(markStorePwaInstallGuidanceShown(fallbackUrl))}`;
  }

  return `${intentTarget}${intentMarker}${intentOptions.join(";")}`;
}

export function continueStorePwaInstallNavigation(url, target, targetWindow = window) {
  const guidedUrl = markIntentAndFallbackGuided(url);
  if (target === "_blank") {
    targetWindow.open(guidedUrl, "_blank", "noopener,noreferrer");
    return;
  }
  targetWindow.location.assign(guidedUrl);
}

export function canShowStorePwaInstallGuide({
  isAndroid,
  storeId,
  appStoreId,
  storeType,
  pwaEnabled,
  isStandalone
}) {
  return Boolean(
    isAndroid
    && storeId
    && String(storeId) === String(appStoreId)
    && STORE_TYPES_WITH_PWA.has(storeType)
    && pwaEnabled
    && !isStandalone
  );
}

export function getStorePwaInstallGuideDismissalKey(storeId) {
  return `souqak:pwa-install-guide:dismissed:${String(storeId)}`;
}

export function isStorePwaInstallGuideDismissed(
  storeId,
  storage = localStorage,
  now = Date.now()
) {
  const key = getStorePwaInstallGuideDismissalKey(storeId);
  const expiresAt = Number(storage.getItem(key));
  if (Number.isFinite(expiresAt) && expiresAt > now) return true;
  if (storage.getItem(key) !== null) storage.removeItem(key);
  return false;
}

export function shouldShowStorePwaInstallGuide(
  storeId,
  source,
  storage = localStorage,
  now = Date.now()
) {
  return source === "method-button"
    || !isStorePwaInstallGuideDismissed(storeId, storage, now);
}

export function dismissStorePwaInstallGuide(
  storeId,
  storage = localStorage,
  now = Date.now()
) {
  storage.setItem(
    getStorePwaInstallGuideDismissalKey(storeId),
    String(now + STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS)
  );
}

export function createStorePwaInstallGuideController({
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  delayMs = STORE_PWA_INSTALL_GUIDE_DELAY_MS,
  onGuide,
  onNativeInstall
}) {
  let state = "idle";
  let timer = null;
  let disposed = false;

  const clearPendingTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  return {
    request(nativeInstallAvailable = false, delay = delayMs) {
      if (disposed) return;
      clearPendingTimer();
      if (nativeInstallAvailable) {
        state = "native";
        onNativeInstall();
        return;
      }

      if (delay <= 0) {
        state = "guide";
        onGuide();
        return;
      }

      state = "waiting";
      timer = setTimer(() => {
        timer = null;
        if (disposed || state !== "waiting") return;
        state = "guide";
        onGuide();
      }, delay);
    },
    nativeInstallAvailable() {
      if (disposed || (state !== "waiting" && state !== "guide")) return false;
      clearPendingTimer();
      state = "native";
      onNativeInstall();
      return true;
    },
    dismiss() {
      if (disposed || state !== "guide") return false;
      clearPendingTimer();
      state = "idle";
      return true;
    },
    cancel() {
      clearPendingTimer();
      state = "idle";
    },
    dispose() {
      clearPendingTimer();
      state = "disposed";
      disposed = true;
    },
    getState() {
      return state;
    }
  };
}
