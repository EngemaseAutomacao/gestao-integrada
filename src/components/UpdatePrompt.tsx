import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { APP_VERSION } from "@/version";
import { applyAppUpdate, fetchLatestVersion } from "@/lib/appUpdate";

const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
const NOTIFIED_VERSION_KEY = "engemase_notified_version";

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const notifiedRef = useRef<string | null>(null);

  const showUpdateNotification = useCallback((newVersion: string) => {
    // Only notify once per version
    const alreadyNotified = localStorage.getItem(NOTIFIED_VERSION_KEY);
    if (alreadyNotified === newVersion || notifiedRef.current === newVersion) return;
    notifiedRef.current = newVersion;
    localStorage.setItem(NOTIFIED_VERSION_KEY, newVersion);

    // Somente via Service Worker — evita a notificação "genérica do Chrome"
    // (sino + logo do navegador) que aparece quando usamos `new Notification()`.
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        (registration as any).showNotification("Nova Atualização Disponível! 🚀", {
          body: `Versão ${newVersion} está disponível. Atualize para obter as últimas melhorias.`,
          icon: "/icon-192.png",
          badge: "/mono-192.png",
          tag: "system-update",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: "update", title: "Atualizar Agora" },
            { action: "close", title: "Depois" }
          ]
        });
      }).catch(() => {});
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    const latest = await fetchLatestVersion();
    if (latest && latest !== APP_VERSION) {
      console.log(`[Update] Nova versão disponível: ${latest} (atual: ${APP_VERSION})`);
      setUpdateAvailable(true);
      setDismissed(false);
      showUpdateNotification(latest);
    }
  }, [showUpdateNotification]);

  useEffect(() => {
    // Check immediately after mount
    const timeout = setTimeout(checkForUpdate, 1500);
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);

    // Check when tab becomes visible or window regains focus
    // (user coming back to the app is the moment they most expect fresh info)
    let lastCheck = Date.now();
    const throttledCheck = () => {
      const now = Date.now();
      if (now - lastCheck < 10_000) return; // avoid double-firing
      lastCheck = now;
      checkForUpdate();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") throttledCheck();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", throttledCheck);
    window.addEventListener("online", throttledCheck);

    // Ask SW to also check now
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CHECK_VERSION" });
    }

    // Listen for SW version messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "VERSION_UPDATED") {
        setUpdateAvailable(true);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", throttledCheck);
      window.removeEventListener("online", throttledCheck);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, [checkForUpdate]);

  const handleUpdate = async () => {
    await applyAppUpdate();
  };



  // If we are in local development, we don't want to show the prompt constantly 
  // since the version in version.json and APP_VERSION are usually the same
  // But if you are testing the build locally, it might show up.
  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] flex justify-center animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-md w-full">
        <RefreshCw className="w-5 h-5 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Nova versão disponível!</p>
          <p className="text-xs opacity-80">Atualize para obter as últimas melhorias.</p>
        </div>
        <button
          onClick={handleUpdate}
          className="bg-primary-foreground text-primary text-sm font-semibold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity shrink-0"
        >
          Atualizar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
