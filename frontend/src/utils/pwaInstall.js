let deferredPrompt = null;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new CustomEvent("pwa:can-install"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa:installed"));
  });
}

export const canInstallPWA = () => Boolean(deferredPrompt) && !isStandalone();

export const installPWA = async () => {
  if (!canInstallPWA()) return null;

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  promptEvent.prompt();
  const choice = await promptEvent.userChoice;

  if (choice.outcome === "accepted") {
    window.dispatchEvent(new CustomEvent("pwa:installed"));
  }

  return choice.outcome;
};