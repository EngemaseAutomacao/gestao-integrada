import { Hono, type MiddlewareHandler } from "hono";
import { timingSafeEqual } from "node:crypto";
import { unauthorized } from "../lib/http.js";
import { runCleanup } from "../services/cleanup.js";
import { runNotificationChecks, runNotificationChecksIfDue } from "../services/jobs.js";
import { syncGoogleSheets } from "../services/syncSheets.js";
import { syncTrello } from "../services/syncTrello.js";

/**
 * Endpoints chamados pelo Vercel Cron (ver vercel.json). A Vercel envia
 * `Authorization: Bearer <CRON_SECRET>` automaticamente quando CRON_SECRET existe.
 */
const requireCronSecret: MiddlewareHandler = async (c, next) => {
  const secret = process.env.CRON_SECRET;
  const header = c.req.header("authorization");
  if (!secret || header !== `Bearer ${secret}`) throw unauthorized("Cron não autorizado");
  await next();
};

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verificação frequente e barata dos avisos, chamada por um agendador externo
 * (o cron da Vercel no plano Hobby só roda 1x por dia). Aceita o CRON_SECRET no
 * header ou a TICK_SECRET em ?key= (mais simples de configurar no agendador).
 */
const tickRoutes = new Hono().get("/", async (c) => {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const tickSecret = process.env.TICK_SECRET ?? "";
  const byHeader = !!cronSecret && sameSecret(c.req.header("authorization") ?? "", `Bearer ${cronSecret}`);
  const byKey = tickSecret.length >= 20 && sameSecret(c.req.query("key") ?? "", tickSecret);
  if (!byHeader && !byKey) throw unauthorized("Cron não autorizado");
  const results = await runNotificationChecksIfDue();
  return c.json({ success: true, ran: results !== null, results });
});

export const cronRoutes = new Hono()
  .route("/tick", tickRoutes)
  .use(requireCronSecret)
  .get("/notifications", async (c) => c.json({ success: true, results: await runNotificationChecks() }))
  .get("/cleanup", async (c) => c.json({ success: true, results: await runCleanup() }))
  .get("/trello", async (c) => c.json({ success: true, summary: await syncTrello() }))
  .get("/sheets", async (c) => c.json({ success: true, summary: await syncGoogleSheets() }));
