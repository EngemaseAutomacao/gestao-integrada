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

/**
 * Envia a mensagem para todas as inscrições do usuário. Inscrições expiradas
 * (404/410) são removidas — no sistema antigo elas ficavam acumulando.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await db.push_subscriptions.findMany({ where: { user_id: userId } });
  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    tag: msg.tag,
    icon: "/icon-192.png",
    badge: "/badge-icon.png",
    data: msg.data ?? {},
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
        await db.push_subscriptions
          .update({ where: { id: sub.id }, data: { last_used_at: new Date() } })
          .catch(() => {});
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await db.push_subscriptions.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] falha ao enviar", { endpoint: sub.endpoint, status, err: String(err) });
        }
      }
    }),
  );
  return sent;
}
