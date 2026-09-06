/**
 * Subscribe user to push notifications
 */
export const subscribeToPush = async (api) => {
  if (!api) {
    console.error("API instance is required for push subscription");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push notifications not supported");
    return;
  }

  try {
    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    // Fetch the current key before reusing a browser subscription. A key
    // rotation makes the old subscription unusable by the production server.
    const { data } = await api.get("/auth/vapid-public-key");
    const vapidPublicKey = data?.publicKey;
    if (!vapidPublicKey) {
      throw new Error("Push notifications are not configured on the server");
    }
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // 2. Check if already subscribed
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

    if (existingSubscription) {
      // Send to backend just in case it's not saved there
      await api.post("/auth/subscribe", {
        subscription: existingSubscription,
        deviceType: getDeviceType()
      });
      localStorage.setItem("souqak-push-vapid-key", vapidPublicKey);
      return;
    }

    // 3. Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // 4. Send to backend
    await api.post("/auth/subscribe", {
      subscription,
      deviceType: getDeviceType()
    });
    localStorage.setItem("souqak-push-vapid-key", vapidPublicKey);

    console.log("User subscribed to push notifications");
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
  }
};

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
