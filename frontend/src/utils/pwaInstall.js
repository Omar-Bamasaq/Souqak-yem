const deferredPrompts = new Map();
let activeInstallTarget = "souqak";
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

export const canInstallPWA = (target = "souqak") =>
  deferredPrompts.has(target)
  && (target !== "souqak" || !isStandalone());

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