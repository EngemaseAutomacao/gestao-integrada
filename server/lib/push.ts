import webpush from "web-push";
import { db } from "./db.js";

/**
 * Envio de Web Push (VAPID). Substitui a implementação manual de criptografia
 * da antiga edge function `send-push-notification`.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — push desativado");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@engemase.com.br", pub, priv);
  configured = true;
  return true;
}

/** Hosts de serviços de push conhecidos (evita SSRF via endpoint arbitrário). */
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "mozaws.net",
  "web.push.apple.com",
  "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
  } catch {
    return false;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/** Nome do serviço de push a partir do endpoint (para diagnóstico). */
function pushService(endpoint: string): string {
  const host = (() => {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return "";
    }
  })();
  if (host.endsWith("web.push.apple.com")) return "iPhone/Mac (Apple)";
  if (host.endsWith("googleapis.com")) return "Android/Chrome (Google)";
  if (host.endsWith("mozilla.com") || host.endsWith("mozaws.net")) return "Firefox";
  if (host.endsWith("notify.windows.com")) return "Windows";
  return host || "desconhecido";
}

export interface PushDeviceResult {
  device: string;
  ok: boolean;
  status: number | null;
  removed: boolean;
}

/**
 * Envia a mensagem para todas as inscrições do usuário e diz o que houve com
 * cada aparelho. Inscrições recusadas pelo serviço de push são removidas:
 * 404/410 = expirada; 401/403 = feita com outra chave VAPID (ex.: a do sistema
 * antigo). Sem a inscrição, o app se reinscreve sozinho na próxima abertura.
 */
export async function sendPushToUserDetailed(userId: string, msg: PushMessage): Promise<PushDeviceResult[]> {
  if (!ensureConfigured()) return [];
  const subs = await db.push_subscriptions.findMany({ where: { user_id: userId } });
  if (subs.length === 0) return [];

  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    tag: msg.tag,
    icon: "/icon-192.png",
    badge: "/badge-icon.png",
    data: msg.data ?? {},
  });

  return Promise.all(
    subs.map(async (sub): Promise<PushDeviceResult> => {
      const device = pushService(sub.endpoint);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        await db.push_subscriptions
          .update({ where: { id: sub.id }, data: { last_used_at: new Date() } })
          .catch(() => {});
        return { device, ok: true, status: 201, removed: false };
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode ?? null;
        const invalid = status === 401 || status === 403 || status === 404 || status === 410;
        if (invalid) {
          await db.push_subscriptions.delete({ where: { id: sub.id } }).catch(() => {});
        }
        console.error("[push] falha ao enviar", { device, status, removed: invalid, err: String(err).slice(0, 300) });
        return { device, ok: false, status, removed: invalid };
      }
    }),
  );
}

export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  const results = await sendPushToUserDetailed(userId, msg);
  return results.filter((r) => r.ok).length;
}
