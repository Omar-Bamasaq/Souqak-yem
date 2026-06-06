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

    // 2. Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Send to backend just in case it's not saved there
      await api.post("/auth/subscribe", {
        subscription: existingSubscription,
        deviceType: getDeviceType()
      });
      return;
    }

    // 3. Get VAPID public key
    const { data } = await api.get("/auth/vapid-public-key");
    const vapidPublicKey = data.publicKey;

    // 4. Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // 5. Send to backend
    await api.post("/auth/subscribe", {
      subscription,
      deviceType: getDeviceType()
    });

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
