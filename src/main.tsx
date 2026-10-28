import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import { APP_VERSION } from "./version.ts";
import { initSentry } from "./lib/sentry";
import { registerServiceWorker } from "./lib/registerSW";

// Inicializa monitoramento de erros (no-op sem VITE_SENTRY_DSN)
initSentry();

// Registra o SW (gerado pelo vite-plugin-pwa em /sw.js) — só fora de preview/dev
registerServiceWorker();


// Run version check as plain JS BEFORE React mounts
// This avoids the duplicate-React hook crash
(function checkVersionBeforeMount() {
  const VERSION_KEY = "engemase_app_version";
  const stored = localStorage.getItem(VERSION_KEY);

  if (!stored) {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  } else if (stored !== APP_VERSION) {
    // Just record the new version. DO NOT auto-reload here — the UpdatePrompt
    // banner is responsible for showing the user a button to update.
    console.log(`[Version] Bundle updated: ${stored} → ${APP_VERSION}`);
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }

  // Keep SW alive for PWA but DO NOT auto-reload.
  // The UpdatePrompt component shows a banner and lets the user click "Atualizar".
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.update().catch(() => {});
    });

    // Listen for SW messages, but only forward sync triggers.
    // VERSION_UPDATED is handled by UpdatePrompt to show the update banner.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "TRIGGER_SYNC") {
        window.dispatchEvent(new CustomEvent("sw-trigger-sync"));
      }
    });
  }
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Global splash fallback: hide once React has mounted, regardless of route.
// (Layout only hides splash on authenticated routes; public routes like /auth
// would otherwise leave the splash visible forever.)
const hideSplash = () => {
  const splash = document.getElementById("splash-screen");
  if (!splash || splash.dataset.hiding) return;
  splash.dataset.hiding = "1";
  const MIN_MS = 1800;
  const elapsed = Date.now() - ((window as any).__SPLASH_START__ || Date.now());
  const wait = Math.max(0, MIN_MS - elapsed);
  setTimeout(() => {
    splash.classList.add("splash-out");
    setTimeout(() => splash.remove(), 450);
  }, wait);
};
requestAnimationFrame(() => setTimeout(hideSplash, 250));

