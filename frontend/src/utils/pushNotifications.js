/**
 * Subscribe user to push notifications
 */
export const subscribeToPush = async (api, { requestPermission = true, storeScoped = false } = {}) => {
  if (!api) {
    throw new Error("API instance is required for push subscription");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await getActiveServiceWorkerRegistration();
  if (!registration) {
    return null;
  }

  if (Notification.permission !== "granted") {
    if (!requestPermission || Notification.permission === "denied") return null;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
  }

  // Fetch the current key before reusing a browser subscription. A key
  // rotation makes the old subscription unusable by the production server.
  const { data } = await api.get("/auth/vapid-public-key");
  const vapidPublicKey = data?.publicKey;
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured on the server");
  }
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  let existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    const storedVapidKey = localStorage.getItem("souqak-push-vapid-key");
    const subscriptionKey = existingSubscription.options?.applicationServerKey;
    const hasKeyChanged = !storedVapidKey || storedVapidKey !== vapidPublicKey;
    const hasKnownDifferentKey = subscriptionKey && !sameBytes(subscriptionKey, applicationServerKey);

    if (hasKeyChanged || hasKnownDifferentKey) {
      await existingSubscription.unsubscribe();
      existingSubscription = null;
    }
  }

  if (!existingSubscription) {
    existingSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  const subscriptionJson = existingSubscription.toJSON();
  if (!storeScoped) {
    await api.post("/auth/subscribe", {
      subscription: subscriptionJson,
      deviceType: getDeviceType()
    });
  }
  localStorage.setItem("souqak-push-vapid-key", vapidPublicKey);

  return subscriptionJson;
};

async function getActiveServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  if (registration.active) return registration;

  let timeout;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), 10000);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Helper to get device type
 */
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function sameBytes(first, second) {
  const firstBytes = new Uint8Array(first);
  if (firstBytes.length !== second.length) return false;
  return firstBytes.every((value, index) => value === second[index]);
}
