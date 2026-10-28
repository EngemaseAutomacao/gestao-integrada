import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin, type AuthVars } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { badRequest, parseBody, uuid } from "../lib/http.js";
import { createNotifications, dispatchPendingPush } from "../lib/notify.js";
import { isAllowedPushEndpoint, sendPushToUserDetailed } from "../lib/push.js";
import { enforceRateLimit } from "../lib/rateLimit.js";

export const notificationRoutes = new Hono<{ Variables: AuthVars }>()
  /** Notificações do próprio usuário (o sino antes listava sem filtro e dependia da RLS). */
  .get("/", async (c) => {
    const user = c.get("user");
    const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
    const rows = await db.notifications.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return c.json(rows);
  })

  .get("/unread-count", async (c) => {
    const user = c.get("user");
    const count = await db.notifications.count({ where: { user_id: user.id, read: false } });
    return c.json({ count });
  })

  .post("/read", async (c) => {
    const user = c.get("user");
    const body = await parseBody(c, z.object({ ids: z.array(uuid).max(500).optional(), all: z.boolean().optional() }));
    if (!body.all && !body.ids?.length) throw badRequest("Informe as notificações");
    const { count } = await db.notifications.updateMany({
      where: { user_id: user.id, read: false, ...(body.all ? {} : { id: { in: body.ids } }) },
      data: { read: true },
    });
    return c.json({ updated: count });
  })

  /** Notificação de teste para o próprio usuário. */
  .post("/test", async (c) => {
    const user = c.get("user");
    await enforceRateLimit(`notif-test:${user.id}`, 5, 60);
    const title = "🔔 Notificação de Teste";
    const message = "Esta é uma notificação de teste para verificar se o sistema está funcionando corretamente.";
    // Já grava como enviada: o push sai abaixo, com o resultado de cada aparelho.
    await db.notifications.create({
      data: { user_id: user.id, type: "test", title, message, read: false, push_sent: true },
    });
    const devices = await sendPushToUserDetailed(user.id, { title, body: message, tag: `test-${Date.now()}` });
    return c.json({
      success: true,
      subscriptionsCount: devices.length,
      sentCount: devices.filter((d) => d.ok).length,
      devices,
    });
  })

  /** Envio manual pelo admin para um ou vários usuários. */
  .post("/send", requireAdmin, async (c) => {
    const admin = c.get("user");
    await enforceRateLimit(`notif-send:${admin.id}`, 20, 60);
    const body = await parseBody(
      c,
      z.object({
        userIds: z.array(uuid).min(1, "Selecione ao menos um destinatário").max(1000),
        title: z.string().trim().min(1, "Informe o título").max(120),
        body: z.string().trim().min(1, "Informe a mensagem").max(1000),
        type: z.string().max(40).optional(),
      }),
    );
    await createNotifications(
      body.userIds.map((id) => ({ user_id: id, type: body.type || "manual", title: body.title, message: body.body })),
    );
    const subscriptionsCount = await db.push_subscriptions.count({ where: { user_id: { in: body.userIds } } });
    const { pushed } = await dispatchPendingPush(1000);
    await logAction({
      action: "manual_notification",
      entity_type: "notification",
      user_id: admin.id,
      user_name: admin.full_name,
      details: { title: body.title, recipients: body.userIds.length, delivered: pushed },
    });
    return c.json({ success: true, recipients: body.userIds.length, subscriptionsCount, sentCount: pushed });
  });

export const pushRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/public-key", (c) => c.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }))

  .get("/status", async (c) => {
    const user = c.get("user");
    const endpoint = c.req.query("endpoint");
    if (!endpoint) return c.json({ subscribed: false });
    const sub = await db.push_subscriptions.findUnique({
      where: { user_id_endpoint: { user_id: user.id, endpoint } },
      select: { id: true },
    });
    return c.json({ subscribed: !!sub });
  })

  .post("/subscribe", async (c) => {
    const user = c.get("user");
    const body = await parseBody(
      c,
      z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
      }),
    );
    if (!isAllowedPushEndpoint(body.endpoint)) throw badRequest("Serviço de push não suportado");
    // Cada aparelho mantém a sua inscrição; as inválidas são removidas no envio.
    await db.push_subscriptions.upsert({
      where: { user_id_endpoint: { user_id: user.id, endpoint: body.endpoint } },
      create: { user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
      update: { p256dh: body.keys.p256dh, auth: body.keys.auth, last_used_at: new Date() },
    });
    return c.json({ success: true });
  })

  .post("/unsubscribe", async (c) => {
    const user = c.get("user");
    const body = await parseBody(c, z.object({ endpoint: z.string().max(2000) }));
    await db.push_subscriptions.deleteMany({ where: { user_id: user.id, endpoint: body.endpoint } });
    return c.json({ success: true });
  });
