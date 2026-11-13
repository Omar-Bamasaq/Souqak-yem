const deferredPrompts = new Map();
let activeInstallTarget = "souqak";
let promptingTarget = null;

export const isPWAStandalone = () =>
  typeof window !== "undefined" && (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );

export const getPWAInstallGuidance = ({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  standalone = false,
  canInstall = false
} = {}) => {
  if (standalone) return null;

  const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1);
  const isInAppBrowser = /FBAN|FBAV|FB_IAB|FB4A|WhatsApp|Instagram/i.test(userAgent);

  if (isIOS) return isInAppBrowser ? "ios-in-app" : "ios";
  if (isInAppBrowser) return "in-app";
  if (canInstall) return null;

  const isAndroidChrome = /Android/i.test(userAgent)
    && /Chrome\/\d+/i.test(userAgent)
    && !/EdgA?|OPR|SamsungBrowser|DuckDuckGo/i.test(userAgent);

  return isAndroidChrome ? "android-chrome" : null;
};

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

export const canInstallPWA = (target = "souqak") =>
  deferredPrompts.has(target)
  && (target !== "souqak" || !isPWAStandalone());

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