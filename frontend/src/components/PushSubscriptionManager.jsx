import { useEffect, useState } from "react";
import { useAuth } from "../store/AuthContext.jsx";
import { subscribeToPush } from "../utils/pushNotifications.js";
import { useApi } from "../api/axios.js";

/**
 * Component to manage push subscription automatically
 * Runs in the background and ensures user is subscribed if permission is granted
 */
export default function PushSubscriptionManager() {
  const { user } = useAuth();
  const api = useApi();
  const [hasRequested, setHasRequested] = useState(false);

  useEffect(() => {
    const handleSubscription = async () => {
      // Only attempt if user is logged in
      if (!user) return;

      // Check if browser supports push
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      // Request permission if we haven't already and it's not denied
      if (!hasRequested && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
          setHasRequested(true);
        } catch (error) {
          console.error("Permission request error:", error);
        }
      }

      // If permission is granted, ensure we are subscribed on the backend
      if (Notification.permission === "granted") {
        try {
          await subscribeToPush(api);
        } catch (error) {
          console.error("Auto-push subscription error:", error);
        }
      }
    };

    handleSubscription();
  }, [user, api, hasRequested]);

  return null; // This component doesn't render anything
}
