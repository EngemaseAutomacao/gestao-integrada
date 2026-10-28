import type { Hono, MiddlewareHandler } from "hono";
import type { AuthVars } from "../lib/auth.js";
import { logRoutes, retentionRoutes, searchRoutes, siteRoutes, statsRoutes, syncRoutes } from "./admin.js";
import { authRoutes } from "./auth.js";
import { cronRoutes } from "./cron.js";
import { fileRoutes } from "./files.js";
import { setupRoutes } from "./setup.js";
import { notificationRoutes, pushRoutes } from "./notifications.js";
import { toolCheckoutRoutes, toolRoutes } from "./tools.js";
import { userRoutes } from "./users.js";
import { vehicleCheckoutRoutes, vehicleRoutes } from "./vehicles.js";

/** Registra todas as rotas. As que exigem login passam por `requireAuth`. */
export function adminRoutesMount(app: Hono<{ Variables: AuthVars }>, requireAuth: MiddlewareHandler<{ Variables: AuthVars }>) {
  app.route("/auth", authRoutes);
  app.route("/cron", cronRoutes);
  app.route("/setup", setupRoutes);

  const protectedPaths = [
    "/users",
    "/tools",
    "/tool-checkouts",
    "/vehicles",
    "/vehicle-checkouts",
    "/files",
    "/notifications",
    "/push",
    "/construction-sites",
    "/sync",
    "/logs",
    "/retention",
    "/stats",
    "/search",
  ];
  for (const p of protectedPaths) {
    app.use(p, requireAuth);
    app.use(`${p}/*`, requireAuth);
  }

  app.route("/users", userRoutes);
  app.route("/tools", toolRoutes);
  app.route("/tool-checkouts", toolCheckoutRoutes);
  app.route("/vehicles", vehicleRoutes);
  app.route("/vehicle-checkouts", vehicleCheckoutRoutes);
  app.route("/files", fileRoutes);
  app.route("/notifications", notificationRoutes);
  app.route("/push", pushRoutes);
  app.route("/construction-sites", siteRoutes);
  app.route("/sync", syncRoutes);
  app.route("/logs", logRoutes);
  app.route("/retention", retentionRoutes);
  app.route("/stats", statsRoutes);
  app.route("/search", searchRoutes);
}
