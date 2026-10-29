/// <reference lib="webworker" />
// ============================================================
// Service Worker (gerado via vite-plugin-pwa / injectManifest)
// Preserva integralmente o comportamento do public/sw.js original:
//  - Version polling (/version.json) + banner via postMessage
//  - Background Sync ('sync-pending') -> TRIGGER_SYNC nos clients
//  - Periodic Sync ('engemase-periodic-sync')
//  - Push agrupado por tag
//  - Notification click/close
// Adiciona: precache automático e versionado do Workbox.
// ============================================================
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ---- Bypass version.json ANTES do precache do Workbox (senão ele serve cache antigo) ----
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/version.json") {
    event.respondWith(
      fetch(event.request.url + (url.search ? "&" : "?") + "_swbypass=" + Date.now(), {
        cache: "no-store",
      })
    );
  }
});

// ---- Precache automático (substituído no build) ----
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const STATIC_CACHE = "engemase-static-v10";
const DYNAMIC_CACHE = "engemase-dynamic-v10";
const MAX_CACHE_SIZE = 50;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

const urlsToCache = ["/", "/index.html", "/manifest.json", "/icon.png"];

// ---- Version checking ----
let currentVersion: string | null = null;

async function checkForUpdates(): Promise<void> {
  try {
    const response = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const newVersion = data.version as string;

    if (currentVersion === null) {
      currentVersion = newVersion;
      console.log("[SW] Initial version:", currentVersion);
      return;
    }

    if (newVersion !== currentVersion) {
      console.log("[SW] Version changed:", currentVersion, "→", newVersion);
      currentVersion = newVersion;
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) =>
        client.postMessage({ type: "VERSION_UPDATED", version: newVersion })
      );
    }
  } catch {
    /* offline ou erro de rede — ignorar */
  }
}

async function limitCacheSize(name: string, size: number): Promise<void> {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > size) {
    await cache.delete(keys[0]);
    await limitCacheSize(name, size);
  }
}

// ---- Install ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate ----
self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => !keep.includes(n) && !n.startsWith("workbox-"))
            .map((n) => {
              console.log("[SW] Removing old cache:", n);
              return caches.delete(n);
            })
        )
      )
      .then(() => self.clients.claim())
      .then(() => checkForUpdates())
  );
});

// ---- Fetch strategies (mantidas idênticas ao SW custom anterior) ----
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname === "/version.json") {
    event.respondWith(fetch(event.request));
    return;
  }

  // API: sempre rede (dados dinâmicos e privados). Imagens (/api/files) podem
  // usar o cache do navegador via Cache-Control, mas não o cache do SW.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return; // deixa o navegador tratar normalmente
  }

  // HTML navigations — NetworkFirst (nunca servir HTML antigo do cache).
  // Garante que o banner "Atualizar" + reload pegue o index.html novo,
  // sem precisar limpar cache manualmente.
  if (
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone)).then(() => limitCacheSize(DYNAMIC_CACHE, MAX_CACHE_SIZE));
          }
          return response;
        })
        .catch(
          () =>
            (caches.match(event.request) as Promise<Response | undefined>).then(
              (cached) => cached || (caches.match("/") as Promise<Response>)
            ) as Promise<Response>
        )
    );
    return;
  }

  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone)).then(() => limitCacheSize(DYNAMIC_CACHE, MAX_CACHE_SIZE));
          }
          return response;
        })
        .catch(() => caches.match(event.request) as Promise<Response>)
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "error") return response;
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone)).then(() => limitCacheSize(DYNAMIC_CACHE, MAX_CACHE_SIZE));
        return response;
      });
    })
  );
});

// ---- Periodic version check ----
setInterval(() => {
  checkForUpdates();
}, VERSION_CHECK_INTERVAL);

// ---- Message handling ----
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHECK_VERSION") {
    checkForUpdates();
  }
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---- Background Sync (offline_queue) ----
self.addEventListener("sync", (event: any) => {
  if (event.tag === "sync-pending") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({ type: "TRIGGER_SYNC" });
          }
        })
    );
  }
});

// ---- Periodic Background Sync ----
self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === "engemase-periodic-sync") {
    event.waitUntil(
      (async () => {
        await checkForUpdates();
        const clientList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({ type: "TRIGGER_SYNC" });
        }
      })()
    );
  }
});

// ---- Push notifications (com agrupamento) ----
self.addEventListener("push", (event) => {
  // Todo push PRECISA virar notificação: se o SW não mostrar nada, o Chrome
  // exibe a dele ("site atualizado em segundo plano", sem o logo do app) e o
  // iPhone cancela a inscrição depois de alguns pushes "silenciosos".
  let data: any = {};
  try {
    const payload = event.data?.json();
    if (payload && typeof payload === "object") data = payload;
  } catch {
    const text = event.data?.text();
    if (text && text.trim() !== "") data = { body: text };
  }

  const title = (data.title && String(data.title).trim()) || "Gestão Integrada";
  const body = (data.body && String(data.body).trim()) || "Você tem uma nova notificação.";

  // Tag única por notificação para que cada push apareça individualmente
  // no system tray (sem ser silenciosamente substituído pelo anterior).
  const innerData = (data.data || {}) as Record<string, unknown>;
  const tag =
    (innerData.notificationId as string) ||
    data.tag ||
    `engemase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || "/icon-192.png",
      badge: "/notification-badge.png",
      tag,
      data: innerData,
      requireInteraction: false,
      // @ts-expect-error - propriedades não-padrão suportadas em Chromium
      renotify: true,
      silent: false,
      actions: [
        { action: "open", title: "Abrir" },
        { action: "close", title: "Fechar" },
      ],
    })
  );
});



// ---- Inscrição trocada pelo navegador ----
// O navegador pode renovar a inscrição de push sozinho (o endpoint antigo para
// de funcionar). Refaz a inscrição e avisa o servidor, mesmo com o app fechado.
self.addEventListener("pushsubscriptionchange", (event: any) => {
  const oldSub: PushSubscription | null = event.oldSubscription ?? null;
  event.waitUntil(
    (async () => {
      const newSub: PushSubscription | null =
        event.newSubscription ??
        (oldSub?.options?.applicationServerKey
          ? await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: oldSub.options.applicationServerKey,
            })
          : null);
      if (!newSub) return;
      const json = newSub.toJSON();
      const headers = { "Content-Type": "application/json", "X-Requested-With": "engemase" };
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ endpoint: newSub.endpoint, keys: json.keys }),
      });
      if (oldSub && oldSub.endpoint !== newSub.endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({ endpoint: oldSub.endpoint }),
        }).catch(() => {});
      }
    })().catch((err) => console.warn("[SW] pushsubscriptionchange falhou", err))
  );
});

// ---- Notification click ----
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      })
  );
});

self.addEventListener("notificationclose", () => {});

export {};
