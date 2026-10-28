import { Hono, type MiddlewareHandler } from "hono";
import { unauthorized } from "../lib/http.js";
import { runCleanup } from "../services/cleanup.js";
import { runNotificationChecks } from "../services/jobs.js";
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

export const cronRoutes = new Hono()
  .use(requireCronSecret)
  .get("/notifications", async (c) => c.json({ success: true, results: await runNotificationChecks() }))
  .get("/cleanup", async (c) => c.json({ success: true, results: await runCleanup() }))
  .get("/trello", async (c) => c.json({ success: true, summary: await syncTrello() }))
  .get("/sheets", async (c) => c.json({ success: true, summary: await syncGoogleSheets() }));
