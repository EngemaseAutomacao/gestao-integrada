import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Chave pública VAPID: vem do servidor (VAPID_PUBLIC_KEY), com fallback para a chave antiga.
const LEGACY_VAPID_PUBLIC_KEY = "BPHD6GjIr_Uhqq4_kbQGbkQWrILtfsVUCjfhjiMHS8z7n7MeiFamCRRnHmYm6tqGIvXmKbptq3Ct3oM7OBLfeas";
let vapidKeyPromise: Promise<string> | null = null;
const getVapidPublicKey = () =>
  (vapidKeyPromise ??= api
    .get<{ publicKey: string | null }>("/push/public-key")
    .then((r) => r.publicKey || LEGACY_VAPID_PUBLIC_KEY)
    .catch(() => LEGACY_VAPID_PUBLIC_KEY));

/** Compara a chave usada na inscrição existente com a chave atual do servidor. */
function sameKey(sub: PushSubscription, key: string) {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current as ArrayBuffer);
  const b = urlBase64ToUint8Array(key);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Helper to access pushManager with proper typing
const getPushManager = (reg: ServiceWorkerRegistration) => (reg as any).pushManager;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications and push
    const supported = "Notification" in window && 
                      "serviceWorker" in navigator && 
                      "PushManager" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, [user]);

  const checkExistingSubscription = useCallback(async () => {
    if (!user) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription: PushSubscription | null = await getPushManager(registration).getSubscription();

      // Inscrição feita com a chave VAPID antiga (sistema Lovable) não recebe mais push:
      // se a permissão já foi dada, refaz a inscrição em silêncio com a chave atual.
      const vapidKey = await getVapidPublicKey();
      if (subscription && !sameKey(subscription, vapidKey) && Notification.permission === "granted") {
        await subscription.unsubscribe();
        subscription = await getPushManager(registration).subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const json = subscription!.toJSON();
        await api.post("/push/subscribe", {
          endpoint: subscription!.endpoint,
          keys: { p256dh: json.keys?.p256dh || "", auth: json.keys?.auth || "" },
        });
      }

      if (subscription) {
        // Verifica se a inscrição está registrada no servidor
        const { subscribed } = await api.get<{ subscribed: boolean }>("/push/status", {
          endpoint: subscription.endpoint,
        });
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!user) {
      console.warn("User must be logged in to subscribe");
      return false;
    }

    if (!isSupported) {
      console.warn("Push notifications not supported");
      return false;
    }

    setIsLoading(true);

    try {
      // First request permission
      const permissionGranted = await requestPermission();
      if (!permissionGranted) {
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      const vapidKey = await getVapidPublicKey();

      // Check for existing subscription
      let subscription: PushSubscription | null = await getPushManager(registration).getSubscription();

      // Inscrição feita com outra chave VAPID (ex.: antes da migração) não recebe push: refaz.
      if (subscription && !sameKey(subscription, vapidKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }

      // If no subscription, create one
      if (!subscription) {
        subscription = await getPushManager(registration).subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh || "";
      const auth = subscriptionJson.keys?.auth || "";

      // Registra a inscrição deste aparelho (cada aparelho do usuário tem a sua)
      await api.post("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setIsLoading(false);
      return false;
    }
  }, [user, isSupported, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await getPushManager(registration).getSubscription();

      if (subscription) {
        // Remove from database
        await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });

        // Unsubscribe from push
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      setIsLoading(false);
      return false;
    }
  }, [user]);

  const showPushNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        return null;
      }

      try {
        // Somente via Service Worker — evita a notificação genérica do Chrome
        // (ícone de sino + logo do navegador) quando usamos `new Notification()`.
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              icon: "/icon-192.png",
              badge: "/mono-192.png",
              requireInteraction: false,
              ...options,
            });
          });
        }
        return null;
      } catch (error) {
        console.error("Error showing notification:", error);
        return null;
      }
    },
    [isSupported, permission]
  );

  return {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    requestPermission,
    showPushNotification,
  };
}
