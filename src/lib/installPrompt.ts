import { useSyncExternalStore } from "react";

/**
 * Guarda o evento `beforeinstallprompt` assim que o navegador o dispara.
 * O evento costuma chegar antes da tela inicial terminar de carregar; se só a
 * tela escutasse, ele se perdia e o botão "Instalar app" nunca aparecia.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Evento guardado (null se o navegador não oferece instalação ou já instalou). */
export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      deferred = null;
      notify();
    }
  };

  return { canInstall: !!prompt, install };
}
