/**
 * Wrapper guardado para registro do Service Worker.
 * Segue a skill PWA do Lovable: nunca registra em preview/iframe/dev.
 * Suporta kill-switch via ?sw=off.
 */

const SW_PATH = "/sw.js";

function isPreviewOrDevHost(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true; // iframe

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;

  return false;
}

async function unregisterMatchingSWs(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister())
    );
  } catch {
    /* ignore */
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (isPreviewOrDevHost()) {
    await unregisterMatchingSWs();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[pwa] Falha ao registrar SW:", err);
  }
}
