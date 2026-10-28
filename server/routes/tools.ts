import { Hono } from "hono";
import { z } from "zod";
import { isAdmin, requireAdmin, type AuthVars } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db, type Prisma } from "../lib/db.js";
import { badRequest, forbidden, notFound, optionalText, parseBody, parseQuery, uuid } from "../lib/http.js";
import { isSafeStoragePath } from "../lib/storage.js";
import { checkinToolCheckouts, createToolCheckouts, extendToolReturn } from "../services/toolCheckouts.js";
import { dateRange, listLimit, profileSelect } from "./shared.js";

const photoPath = z
  .string()
  .nullish()
  .refine((v) => v == null || v === "" || isSafeStoragePath(v), "Caminho de arquivo inválido")
  .transform((v) => v || null);

export const toolRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/", async (c) => {
    const user = c.get("user");
    const q = parseQuery(
      c,
      z.object({
        available: z.enum(["true", "false"]).optional(),
        q: z.string().max(100).optional(),
        ids: z.string().optional(),
        include_archived: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().int().min(1).max(5000).optional(),
      }),
    );
    const where: Prisma.toolsWhereInput = {};
    if (!(isAdmin(user) && q.include_archived === "true")) where.active = true;
    if (q.available === "true") where.quantity_available = { gt: 0 };
    // Terceiros não veem ferramentas exclusivas de funcionários.
    if (user.category === "third_party") where.employee_only = false;
    if (q.ids) where.id = { in: q.ids.split(",").filter(Boolean) };
    if (q.q) {
      where.OR = ["name", "brand", "tag"].map((f) => ({ [f]: { contains: q.q, mode: "insensitive" } }));
    }
    const rows = await db.tools.findMany({ where, orderBy: { name: "asc" }, take: q.limit });
    return c.json(rows);
  })

  .get("/:id", async (c) => {
    const user = c.get("user");
    const tool = await db.tools.findUnique({ where: { id: uuid.parse(c.req.param("id")) } });
    if (!tool) throw notFound("Ferramenta não encontrada");
    if (tool.employee_only && user.category === "third_party") throw forbidden();
    return c.json(tool);
  })

  /** Histórico de uso da ferramenta. Não-admins veem nomes, mas e-mail/categoria só dos próprios registros. */
  .get("/:id/checkouts", async (c) => {
    const user = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const rows = await db.tool_checkouts.findMany({
      where: { tool_id: id },
      orderBy: { checkout_date: "desc" },
      take: 500,
      include: { user: { select: profileSelect } },
    });
    return c.json(
      rows.map(({ user: p, ...co }) => {
        const own = isAdmin(user) || co.user_id === user.id;
        return {
          ...co,
          notes: own ? co.notes : null,
          profiles: own ? p : { id: p.id, full_name: p.full_name, email: "***", category: "***", username: null },
        };
      }),
    );
  });

const checkoutItem = z.object({
  tool_id: uuid,
  user_id: uuid.nullish(),
  construction_site: optionalText(200),
  estimated_return_date: z.string().nullish(),
  notes: optionalText(2000),
  selected_tag: optionalText(100),
  checkout_date: z.string().nullish(),
  checkout_photo_url: photoPath,
  checkout_signature_url: photoPath,
  client_op_id: z.string().max(100).nullish(),
});

const checkoutInclude = {
  tool: { select: { id: true, name: true, tag: true, brand: true } },
  user: { select: profileSelect },
  checked_out_by_user: { select: { id: true, full_name: true } },
  checked_in_by_user: { select: { id: true, full_name: true } },
} satisfies Prisma.tool_checkoutsInclude;

type CheckoutWithRelations = Prisma.tool_checkoutsGetPayload<{ include: typeof checkoutInclude }>;

/** Formato compatível com o que o frontend recebia do Supabase (tools, profiles...). */
function serializeCheckout(row: CheckoutWithRelations) {
  const { tool, user, checked_out_by_user, checked_in_by_user, ...rest } = row;
  return {
    ...rest,
    tools: tool,
    profiles: user,
    checked_out_by_profile: checked_out_by_user,
    checked_in_by_profile: checked_in_by_user,
  };
}

export const toolCheckoutRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/", async (c) => {
    const user = c.get("user");
    const q = parseQuery(
      c,
      z.object({
        status: z.enum(["checked_out", "checked_in"]).optional(),
        user_id: z.string().optional(),
        tool_id: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        site: z.string().max(200).optional(),
        overdue: z.enum(["true"]).optional(),
        order: z.enum(["checkout_date", "estimated_return_date", "checkin_date"]).optional(),
        dir: z.enum(["asc", "desc"]).optional(),
        limit: z.coerce.number().int().min(1).max(10000).optional(),
        count: z.enum(["true"]).optional(),
        scope: z.enum(["mine", "all"]).optional(),
      }),
    );

    const where: Prisma.tool_checkoutsWhereInput = {};
    // Equivalente à antiga RLS: não-admin só enxerga as próprias retiradas.
    if (!isAdmin(user) || q.scope === "mine") where.user_id = user.id;
    else if (q.user_id) where.user_id = q.user_id;
    if (q.status) where.status = q.status;
    if (q.tool_id) where.tool_id = q.tool_id;
    if (q.site) where.construction_site = { contains: q.site, mode: "insensitive" };
    if (q.overdue) where.estimated_return_date = { lt: new Date() };
    const range = dateRange(q.from, q.to);
    if (range) where.checkout_date = range;

    if (q.count) return c.json({ count: await db.tool_checkouts.count({ where }) });

    const order = q.order ?? "checkout_date";
    const rows = await db.tool_checkouts.findMany({
      where,
      include: checkoutInclude,
      // `nulls` só é aceito em colunas anuláveis.
      orderBy:
        order === "checkout_date"
          ? { checkout_date: q.dir ?? "desc" }
          : { [order]: { sort: q.dir ?? "desc", nulls: "last" } },
      take: listLimit(q.limit),
    });
    return c.json(rows.map(serializeCheckout));
  })

  /** TAGs em uso (sem dados pessoais) — usado na tela de retirada por qualquer usuário. */
  .get("/active-tags", async (c) => {
    const ids = (c.req.query("tool_ids") || "").split(",").filter(Boolean);
    const rows = await db.tool_checkouts.findMany({
      where: { status: "checked_out", selected_tag: { not: null }, ...(ids.length ? { tool_id: { in: ids } } : {}) },
      select: { tool_id: true, selected_tag: true },
    });
    return c.json(rows);
  })

  .post("/", async (c) => {
    const body = await parseBody(
      c,
      z.union([z.object({ items: z.array(checkoutItem).min(1).max(100) }), checkoutItem]),
    );
    const items = "items" in body ? body.items : [body];
    const created = await createToolCheckouts(c.get("user"), items);
    return c.json({ created }, 201);
  })

  .post("/checkin", async (c) => {
    const body = await parseBody(
      c,
      z.object({
        ids: z.array(uuid).min(1).max(100),
        checkin_date: z.string().nullish(),
        notes: optionalText(2000),
        checkin_photo_url: photoPath,
        checkin_signature_url: photoPath,
      }),
    );
    const result = await checkinToolCheckouts(c.get("user"), body.ids, body);
    return c.json(result);
  })

  .post("/:id/extend", async (c) => {
    const body = await parseBody(c, z.object({ estimated_return_date: z.string() }));
    await extendToolReturn(c.get("user"), uuid.parse(c.req.param("id")), body.estimated_return_date);
    return c.json({ success: true });
  })

  /** Edição administrativa de um registro do histórico. */
  .patch("/:id", requireAdmin, async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(
      c,
      z
        .object({
          checkout_date: z.string().optional(),
          checkin_date: z.string().nullable().optional(),
          estimated_return_date: z.string().nullable().optional(),
          construction_site: optionalText(200).optional(),
          selected_tag: optionalText(100).optional(),
          notes: optionalText(2000).optional(),
        })
        .strict(),
    );
    const current = await db.tool_checkouts.findUnique({ where: { id }, include: checkoutInclude });
    if (!current) throw notFound("Registro não encontrado");

    const toDate = (v: string | null | undefined) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw badRequest("Data inválida");
      return d;
    };
    const data: Prisma.tool_checkoutsUpdateInput = {
      checkout_date: toDate(body.checkout_date) ?? undefined,
      estimated_return_date: toDate(body.estimated_return_date),
      construction_site: body.construction_site,
      selected_tag: body.selected_tag,
      notes: body.notes,
    };
    // Data de devolução só pode ser editada em registros já devolvidos.
    if (body.checkin_date !== undefined && current.status === "checked_in") {
      const d = toDate(body.checkin_date);
      if (!d) throw badRequest("Registro devolvido precisa de data de devolução");
      data.checkin_date = d;
    }
    const updated = await db.tool_checkouts.update({ where: { id }, data, include: checkoutInclude });
    await logAction({
      action: "edit_history",
      entity_type: "tool_checkout",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { tool_name: current.tool.name, user_name: current.user.full_name, changes: body },
    });
    return c.json(serializeCheckout(updated));
  })

  .delete("/:id", requireAdmin, async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const reason = c.req.query("reason")?.trim();
    if (!reason || reason.length < 3) throw badRequest("Informe o motivo da exclusão");

    await db.$transaction(async (tx) => {
      const current = await tx.tool_checkouts.findUnique({ where: { id }, include: checkoutInclude });
      if (!current) throw notFound("Registro não encontrado");
      await tx.tool_checkouts.delete({ where: { id } });
      // Excluir uma retirada ainda em aberto devolve a unidade ao estoque.
      if (current.status === "checked_out") {
        await tx.$executeRaw`
          UPDATE tools SET quantity_available = LEAST(quantity_total, quantity_available + 1), updated_at = now()
           WHERE id = ${current.tool_id}::uuid`;
      }
      await logAction(
        {
          action: "delete_history",
          entity_type: "tool_checkout",
          entity_id: id,
          user_id: admin.id,
          user_name: admin.full_name,
          details: { tool_name: current.tool.name, user_name: current.user.full_name, reason },
        },
        tx,
      );
    });
    return c.json({ success: true });
  });
