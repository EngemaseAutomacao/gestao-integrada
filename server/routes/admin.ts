import { Hono } from "hono";
import { z } from "zod";
import { isAdmin, requireAdmin, type AuthVars } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db, type Prisma } from "../lib/db.js";
import { notFound, optionalText, parseBody, parseQuery, uuid } from "../lib/http.js";
import { runCleanup } from "../services/cleanup.js";
import { syncGoogleSheets } from "../services/syncSheets.js";
import { syncTrello } from "../services/syncTrello.js";
import { dateRange } from "./shared.js";

export const siteRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/", async (c) => {
    const active = c.req.query("active");
    const rows = await db.construction_sites.findMany({
      where: active === "true" ? { active: true } : {},
      orderBy: { name: "asc" },
    });
    return c.json(rows);
  })

  .patch("/:id", requireAdmin, async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(
      c,
      z.object({
        name: z.string().trim().min(1, "Nome é obrigatório").max(200).optional(),
        address: optionalText(500).optional(),
        active: z.boolean().optional(),
      }),
    );
    const site = await db.construction_sites.update({ where: { id }, data: body }).catch(() => null);
    if (!site) throw notFound("Obra não encontrada");
    return c.json(site);
  });

export const syncRoutes = new Hono<{ Variables: AuthVars }>()
  .use(requireAdmin)
  .get("/state", async (c) => {
    const rows = await db.sync_state.findMany();
    return c.json(Object.fromEntries(rows.map((r) => [r.key, { last_run_at: r.last_run_at, summary: r.summary }])));
  })
  .post("/trello", async (c) => {
    const summary = await syncTrello();
    return c.json({ success: true, summary });
  })
  .post("/sheets", async (c) => {
    const summary = await syncGoogleSheets();
    return c.json({ success: true, summary });
  });

export const logRoutes = new Hono<{ Variables: AuthVars }>().use(requireAdmin).get("/", async (c) => {
  const q = parseQuery(
    c,
    z.object({
      limit: z.coerce.number().int().min(1).max(5000).optional(),
      entity_type: z.string().max(50).optional(),
      action: z.string().max(50).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  );
  const where: Prisma.system_logsWhereInput = {};
  if (q.entity_type) where.entity_type = q.entity_type;
  if (q.action) where.action = q.action;
  const range = dateRange(q.from, q.to);
  if (range) where.created_at = range;
  const rows = await db.system_logs.findMany({ where, orderBy: { created_at: "desc" }, take: q.limit ?? 500 });
  return c.json(rows);
});

export const retentionRoutes = new Hono<{ Variables: AuthVars }>()
  .use(requireAdmin)
  .get("/", async (c) => c.json(await db.data_retention_settings.findMany({ orderBy: { label: "asc" } })))
  .patch("/:id", async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(
      c,
      z.object({
        enabled: z.boolean().optional(),
        retention_days: z.number().int().min(1).max(3650).optional(),
      }),
    );
    const row = await db.data_retention_settings
      .update({ where: { id }, data: { ...body, updated_by: admin.id } })
      .catch(() => null);
    if (!row) throw notFound("Configuração não encontrada");
    await logAction({
      action: "retention_updated",
      entity_type: "system",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { setting: row.setting_key, ...body },
    });
    return c.json(row);
  })
  .post("/run", async (c) => {
    const admin = c.get("user");
    const results = await runCleanup(admin);
    return c.json({ success: true, results });
  });

export const statsRoutes = new Hono<{ Variables: AuthVars }>()
  /** Contadores do próprio usuário (home, badges). */
  .get("/me", async (c) => {
    const user = c.get("user");
    const now = new Date();
    const [toolsInUse, toolsOverdue, vehiclesOut, unread] = await Promise.all([
      db.tool_checkouts.count({ where: { user_id: user.id, status: "checked_out" } }),
      db.tool_checkouts.count({
        where: { user_id: user.id, status: "checked_out", estimated_return_date: { lt: now } },
      }),
      db.vehicle_checkouts.count({ where: { user_id: user.id, status: "checked_out" } }),
      db.notifications.count({ where: { user_id: user.id, read: false } }),
    ]);
    return c.json({ toolsInUse, toolsOverdue, vehiclesOut, unreadNotifications: unread });
  })

  .get("/vehicles", async (c) => {
    const [total, available, inUse, active] = await Promise.all([
      db.vehicles.count(),
      db.vehicles.count({ where: { status: "available" } }),
      db.vehicles.count({ where: { status: "in_use" } }),
      db.vehicle_checkouts.count({ where: { status: "checked_out" } }),
    ]);
    return c.json({ totalVehicles: total, available, inUse, activeCheckouts: active });
  })

  .get("/admin", requireAdmin, async (c) => {
    const [toolsInUse, vehiclesOut, pendingUsers] = await Promise.all([
      db.tool_checkouts.count({ where: { status: "checked_out" } }),
      db.vehicle_checkouts.count({ where: { status: "checked_out" } }),
      db.profiles.count({ where: { approved: false, password_hash: { not: "" } } }),
    ]);
    return c.json({ toolsInUse, vehiclesOut, pendingUsers });
  })

  /** Dados agregados para a tela de analytics (admin). */
  .get("/analytics", requireAdmin, async (c) => {
    const range = dateRange(c.req.query("from"), c.req.query("to"));
    const [checkouts, tools, users, vehicleCheckouts] = await Promise.all([
      db.tool_checkouts.findMany({
        where: range ? { checkout_date: range } : {},
        select: {
          id: true,
          checkout_date: true,
          checkin_date: true,
          status: true,
          construction_site: true,
          estimated_return_date: true,
          user_id: true,
          tool_id: true,
          tool: { select: { name: true } },
          user: { select: { full_name: true, category: true } },
        },
        take: 20000,
      }),
      db.tools.findMany({ where: { active: true }, select: { id: true, quantity_available: true, quantity_total: true } }),
      db.profiles.findMany({ where: { approved: true }, select: { id: true, category: true } }),
      db.vehicle_checkouts.findMany({
        where: range ? { checkout_date: range } : {},
        select: { id: true, checkout_date: true, checkin_date: true, km_checkout: true, km_checkin: true, status: true },
        take: 20000,
      }),
    ]);
    return c.json({
      checkouts: checkouts.map(({ tool, user, ...r }) => ({ ...r, tools: tool, profiles: user })),
      tools,
      users,
      vehicleCheckouts,
    });
  });

export const searchRoutes = new Hono<{ Variables: AuthVars }>().get("/", async (c) => {
  const user = c.get("user");
  const term = (c.req.query("q") || "").trim();
  const limit = Math.min(Number(c.req.query("limit")) || 6, 20);
  if (term.length < 2) return c.json({ tools: [], vehicles: [], users: [] });
  const contains = { contains: term, mode: "insensitive" as const };

  const [tools, vehicles, users] = await Promise.all([
    db.tools.findMany({
      where: {
        active: true,
        ...(user.category === "third_party" ? { employee_only: false } : {}),
        OR: [{ name: contains }, { brand: contains }, { tag: contains }],
      },
      select: { id: true, name: true, brand: true, tag: true },
      take: limit,
    }),
    db.vehicles.findMany({
      where: { OR: [{ name: contains }, { plate: contains }, { brand: contains }] },
      select: { id: true, name: true, plate: true, brand: true },
      take: limit,
    }),
    isAdmin(user)
      ? db.profiles.findMany({
          where: { OR: [{ full_name: contains }, { email: contains }, { username: contains }] },
          select: { id: true, full_name: true, email: true },
          take: limit,
        })
      : Promise.resolve([]),
  ]);
  return c.json({ tools, vehicles, users });
});
