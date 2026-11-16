export const STORE_PWA_INSTALL_GUIDE_DELAY_MS = 8_000;
export const STORE_PWA_INSTALL_GUIDE_DISMISSAL_MS = 7 * 24 * 60 * 60 * 1_000;

const STORE_TYPES_WITH_PWA = new Set(["store", "family-production"]);

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
