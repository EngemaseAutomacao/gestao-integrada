import { waitUntil } from "@vercel/functions";
import { db, type Tx } from "./db.js";
import { sendPushToUser } from "./push.js";

export interface NewNotification {
  user_id: string;
  type: string;
  title: string;
  message: string;
  tool_id?: string | null;
  checkout_id?: string | null;
}

/** Executa trabalho depois da resposta (na Vercel, mantém a função viva até terminar). */
export function runInBackground(promise: Promise<unknown>) {
  const safe = promise.catch((err) => console.error("[background] erro:", err));
  try {
    waitUntil(safe);
  } catch {
    // fora da Vercel (dev) a promise simplesmente continua rodando
  }
}

/**
 * Grava notificações (dentro da transação, se fornecida). O envio de push é
 * feito por `dispatchPendingPush` depois do commit.
 */
export async function createNotifications(items: NewNotification[], tx?: Tx) {
  const valid = items.filter((n) => n.message && n.message.trim() !== "");
  if (valid.length === 0) return;
  await (tx ?? db).notifications.createMany({
    data: valid.map((n) => ({ ...n, read: false, push_sent: false })),
  });
}

export async function adminIds(tx?: Tx, exclude?: (string | null | undefined)[]): Promise<string[]> {
  const admins = await (tx ?? db).profiles.findMany({
    where: { role: "admin", approved: true },
    select: { id: true },
  });
  const skip = new Set((exclude ?? []).filter(Boolean));
  return admins.map((a) => a.id).filter((id) => !skip.has(id));
}

/**
 * Envia push para notificações ainda não enviadas. Chamado após cada ação e
 * também pelo cron (que pega as que porventura falharam).
 */
export async function dispatchPendingPush(limit = 200): Promise<{ processed: number; pushed: number }> {
  const pending = await db.notifications.findMany({
    where: { push_sent: false },
    orderBy: { created_at: "asc" },
    take: limit,
  });
  if (pending.length === 0) return { processed: 0, pushed: 0 };

  // Marca antes de enviar para evitar envio duplicado por execuções concorrentes.
  const { count } = await db.notifications.updateMany({
    where: { id: { in: pending.map((n) => n.id) }, push_sent: false },
    data: { push_sent: true },
  });
  if (count === 0) return { processed: 0, pushed: 0 };

  let pushed = 0;
  for (const n of pending) {
    pushed += await sendPushToUser(n.user_id, {
      title: n.title,
      body: n.message,
      tag: n.id,
      data: { notificationId: n.id, type: n.type, toolId: n.tool_id, checkoutId: n.checkout_id },
    });
  }
  return { processed: pending.length, pushed };
}

export function dispatchPushInBackground() {
  runInBackground(dispatchPendingPush());
}
