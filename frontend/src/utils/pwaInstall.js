const deferredPrompts = new Map();
const storePwaAppContext = typeof window !== "undefined" ? window.__SOUQAK_STORE_PWA_APP__ : null;
const initialInstallTarget = storePwaAppContext?.storeId
  ? `store:${storePwaAppContext.storeId}`
  : "souqak";
let activeInstallTarget = initialInstallTarget;
let promptingTarget = null;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function dispatchInstallEvent(name, target) {
  window.dispatchEvent(new CustomEvent(name, { detail: { target } }));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (!activeInstallTarget) return;
    deferredPrompts.set(activeInstallTarget, event);
    dispatchInstallEvent("pwa:can-install", activeInstallTarget);
  });

  window.addEventListener("appinstalled", () => {
    const target = promptingTarget || activeInstallTarget;
    deferredPrompts.delete(target);
    promptingTarget = null;
    dispatchInstallEvent("pwa:installed", target);
  });
}

export const setPWAInstallTarget = (target) => {
  activeInstallTarget = target || null;
};

export const getPWAInstallTarget = () => activeInstallTarget;

export const isStandalonePWA = isStandalone;

export const canInstallPWA = (target = "souqak") => {
  const isCurrentStoreApp = storePwaAppContext?.storeId
    && target === `store:${storePwaAppContext.storeId}`;
  return deferredPrompts.has(target)
    && (target !== "souqak" || !isStandalone())
    && (!isCurrentStoreApp || !isStandalone());
};

export const installPWA = async (target = "souqak") => {
  if (!canInstallPWA(target)) return null;

  const promptEvent = deferredPrompts.get(target);
  deferredPrompts.delete(target);
  promptingTarget = target;
  dispatchInstallEvent("pwa:can-install", target);

  try {
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      dispatchInstallEvent("pwa:installed", target);
    }
    promptingTarget = null;
    return choice.outcome;
  } catch (error) {
    promptingTarget = null;
    throw error;
  }
};