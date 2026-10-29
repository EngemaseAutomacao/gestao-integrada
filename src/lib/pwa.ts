/**
 * PWA Capabilities — utilitários feature-detected.
 * Todas as funções fazem fallback silencioso quando a API não está disponível.
 */

// ===== App Badging API =====
export async function setAppBadge(count: number): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0 && nav.setAppBadge) {
      await nav.setAppBadge(count);
    } else if (nav.clearAppBadge) {
      await nav.clearAppBadge();
    }
  } catch {
    /* ignore */
  }
}

// ===== Vibration API =====
export function vibrate(pattern: number | number[] = 30): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export const VibrationPatterns: Record<string, number[]> = {
  success: [40],
  warning: [60, 40, 60],
  error: [100, 50, 100, 50, 100],
  tap: [15],
};

// ===== Web Share API =====
export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export function canShare(payload?: SharePayload): boolean {
  if (typeof navigator === "undefined" || !("share" in navigator)) return false;
  if (payload?.files && payload.files.length > 0) {
    return typeof (navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare === "function"
      ? (navigator as any).canShare(payload)
      : false;
  }
  return true;
}

export async function shareContent(payload: SharePayload): Promise<boolean> {
  try {
    if (!canShare(payload)) {
      // Fallback: copia URL/texto para clipboard
      const fallback = payload.url ?? payload.text ?? "";
      if (fallback && navigator.clipboard) {
        await navigator.clipboard.writeText(fallback);
        return true;
      }
      return false;
    }
    await navigator.share(payload as ShareData);
    return true;
  } catch (err: any) {
    // AbortError = usuário cancelou; não é erro
    if (err?.name === "AbortError") return false;
    console.warn("[pwa] share failed", err);
    return false;
  }
}

// Geolocation removido do app — apenas Câmera e Notificações são solicitadas.

// ===== Periodic Background Sync =====
export async function registerPeriodicSync(
  tag = "engemase-periodic-sync",
  minIntervalMs = 12 * 60 * 60 * 1000 // 12h
): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (!reg.periodicSync) return false;

    // Verifica permissão
    const status = await (navigator as any).permissions?.query?.({
      name: "periodic-background-sync" as PermissionName,
    });
    if (status && status.state !== "granted") return false;

    await reg.periodicSync.register(tag, { minInterval: minIntervalMs });
    return true;
  } catch {
    return false;
  }
}

// ===== File System Access (save reports) =====
export interface SaveFileOptions {
  suggestedName: string;
  mimeType?: string;
  description?: string;
  extension?: string; // ".csv", ".pdf"
}

export async function saveFileToDisk(
  data: Blob | string,
  opts: SaveFileOptions
): Promise<boolean> {
  const blob = typeof data === "string"
    ? new Blob([data], { type: opts.mimeType ?? "text/plain;charset=utf-8" })
    : data;

  const win = window as Window & {
    showSaveFilePicker?: (opts: any) => Promise<any>;
  };

  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: opts.suggestedName,
        types: [
          {
            description: opts.description ?? "Arquivo",
            accept: { [opts.mimeType ?? "application/octet-stream"]: [opts.extension ?? ""] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === "AbortError") return false;
      // cai no fallback
    }
  }

  // Fallback: download tradicional via <a download>
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch {
    return false;
  }
}

// ===== Notification Triggers (lembretes locais agendados) =====
export interface ScheduledReminderOptions {
  title: string;
  body: string;
  /** Timestamp em ms (Date.now() + delay). */
  showAt: number;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function scheduleLocalReminder(
  opts: ScheduledReminderOptions
): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
    if (Notification?.permission !== "granted") return false;
    if (opts.showAt <= Date.now()) return false;

    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      showNotification: (
        title: string,
        options: NotificationOptions & { showTrigger?: unknown; tag?: string }
      ) => Promise<void>;
    };

    // TimestampTrigger só existe em Chromium-based + flag
    const Trigger = (window as any).TimestampTrigger;
    if (typeof Trigger !== "function") {
      // Fallback: setTimeout em memória (perdido ao fechar o app)
      const delay = opts.showAt - Date.now();
      if (delay > 0 && delay < 2_147_483_647) {
        setTimeout(() => {
          reg.showNotification(opts.title, {
            body: opts.body,
            tag: opts.tag,
            data: opts.data,
            icon: "/icon-192.png",
            badge: "/notification-badge.png",
          });
        }, delay);
        return true;
      }
      return false;
    }

    await reg.showNotification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      data: opts.data,
      icon: "/icon-192.png",
      badge: "/notification-badge.png",
      showTrigger: new Trigger(opts.showAt),
    });
    return true;
  } catch (err) {
    console.warn("[pwa] scheduleLocalReminder failed", err);
    return false;
  }
}
