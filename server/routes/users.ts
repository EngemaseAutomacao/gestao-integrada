import { Hono } from "hono";
import { z } from "zod";
import { hashPassword, requireAdmin, toPublicProfile, type AuthVars } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { badRequest, conflict, notFound, parseBody, uuid } from "../lib/http.js";
import { createNotifications, dispatchPushInBackground } from "../lib/notify.js";
import { categorySchema, passwordSchema, usernameSchema } from "./auth.js";

const roleSchema = z.enum(["admin", "employee", "third_party"], { errorMap: () => ({ message: "Função inválida" }) });
const emailSchema = z.string().trim().toLowerCase().email("Formato de email inválido").max(255);
const fullNameSchema = z.string().trim().min(2, "Nome completo deve ter entre 2 e 100 caracteres").max(100);

async function ensureUnique(email: string, username: string, exceptId?: string) {
  const clash = await db.profiles.findFirst({
    where: {
      OR: [{ email: { equals: email, mode: "insensitive" } }, { username }],
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw conflict("Este email ou usuário já está em uso");
}

export const userRoutes = new Hono<{ Variables: AuthVars }>()
  /** Lista mínima (id, nome) de usuários aprovados — usada nos seletores de responsável. */
  .get("/approved", async (c) => {
    const rows = await db.profiles.findMany({
      where: { approved: true, password_hash: { not: "" } },
      select: { id: true, full_name: true },
      orderBy: { full_name: "asc" },
    });
    return c.json(rows);
  })

  .use(requireAdmin)

  .get("/", async (c) => {
    const approved = c.req.query("approved");
    const rows = await db.profiles.findMany({
      // Usuários desativados (excluídos com histórico preservado) não aparecem na gestão.
      where: { password_hash: { not: "" }, ...(approved === undefined ? {} : { approved: approved === "true" }) },
      orderBy: { full_name: "asc" },
    });
    return c.json(rows.map(toPublicProfile));
  })

  .get("/last-access", async (c) => {
    const rows = await db.profiles.findMany({ where: { approved: true } });
    const now = Date.now();
    const result = rows
      .map((p) => {
        const times = [p.last_sign_in_at, p.last_access_at].filter((d): d is Date => !!d).map((d) => d.getTime());
        const last = times.length ? Math.max(...times) : null;
        return {
          id: p.id,
          full_name: p.full_name,
          username: p.username,
          email: p.email,
          category: p.category,
          role: p.role,
          approved: p.approved,
          last_sign_in_at: last ? new Date(last).toISOString() : null,
          days_since_last_access: last ? Math.max(0, Math.floor((now - last) / 86_400_000)) : null,
        };
      })
      .sort((a, b) => (a.last_sign_in_at ?? "").localeCompare(b.last_sign_in_at ?? ""));
    return c.json(result);
  })

  .post("/", async (c) => {
    const admin = c.get("user");
    const body = await parseBody(
      c,
      z.object({
        email: emailSchema,
        password: passwordSchema,
        fullName: fullNameSchema,
        username: usernameSchema,
        category: categorySchema,
        role: roleSchema,
        company: z.string().trim().max(100).nullish(),
      }),
    );
    await ensureUnique(body.email, body.username);
    const created = await db.profiles.create({
      data: {
        email: body.email,
        username: body.username,
        full_name: body.fullName,
        company: body.company || null,
        category: body.category,
        role: body.role,
        approved: true,
        first_login: true, // obriga a troca de senha no primeiro acesso
        password_hash: await hashPassword(body.password),
      },
    });
    await logAction({
      action: "user_created",
      entity_type: "user",
      entity_id: created.id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { created_user: created.full_name, email: created.email, role: created.role },
    });
    return c.json(toPublicProfile(created), 201);
  })

  .patch("/:id", async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(
      c,
      z.object({
        fullName: fullNameSchema,
        email: emailSchema,
        username: usernameSchema,
        company: z.string().trim().max(100, "Nome da empresa deve ter no máximo 100 caracteres").nullish(),
        category: categorySchema,
        role: roleSchema,
      }),
    );
    const current = await db.profiles.findUnique({ where: { id } });
    if (!current) throw notFound("Usuário não encontrado");
    if (id === admin.id && body.role !== "admin") {
      throw badRequest("Você não pode remover seu próprio acesso de administrador");
    }
    await ensureUnique(body.email, body.username, id);
    const updated = await db.profiles.update({
      where: { id },
      data: {
        full_name: body.fullName,
        email: body.email,
        username: body.username,
        company: body.company || null,
        category: body.category,
        role: body.role,
        // Mudança de função derruba as sessões abertas do usuário.
        ...(current.role !== body.role ? { token_version: { increment: 1 } } : {}),
      },
    });
    await logAction({
      action: "user_updated",
      entity_type: "user",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { updated_user: updated.full_name, previous_role: current.role, role: updated.role },
    });
    return c.json(toPublicProfile(updated));
  })

  .post("/:id/approve", async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const user = await db.profiles.update({ where: { id }, data: { approved: true } }).catch(() => null);
    if (!user) throw notFound("Usuário não encontrado");
    await logAction({
      action: "user_approved",
      entity_type: "user",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { approved_user: user.full_name, email: user.email },
    });
    await createNotifications([
      {
        user_id: id,
        type: "user_approved",
        title: "Cadastro aprovado",
        message: "Seu acesso ao Gestão Integrada Engemase foi aprovado. Bem-vindo(a)!",
      },
    ]);
    dispatchPushInBackground();
    return c.json(toPublicProfile(user));
  })

  .patch("/:id/first-login", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(c, z.object({ first_login: z.boolean() }));
    const user = await db.profiles.update({ where: { id }, data: { first_login: body.first_login } }).catch(() => null);
    if (!user) throw notFound("Usuário não encontrado");
    return c.json(toPublicProfile(user));
  })

  .post("/:id/password", async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(c, z.object({ newPassword: passwordSchema }));
    const user = await db.profiles
      .update({
        where: { id },
        data: {
          password_hash: await hashPassword(body.newPassword),
          token_version: { increment: 1 }, // encerra as sessões do usuário
          first_login: true, // força a troca no próximo acesso
        },
      })
      .catch(() => null);
    if (!user) throw notFound("Usuário não encontrado");
    await logAction({
      action: "password_reset_by_admin",
      entity_type: "user",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { target_user: user.full_name },
    });
    return c.json({ success: true });
  })

  .delete("/:id", async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    if (id === admin.id) throw badRequest("Não é possível excluir sua própria conta");
    const user = await db.profiles.findUnique({ where: { id } });
    if (!user) throw notFound("Usuário não encontrado");

    const active =
      (await db.tool_checkouts.count({ where: { user_id: id, status: "checked_out" } })) +
      (await db.vehicle_checkouts.count({ where: { user_id: id, status: "checked_out" } }));
    if (active > 0) {
      throw conflict("Não é possível excluir: o usuário possui ferramentas ou veículos em uso");
    }
    const history =
      (await db.tool_checkouts.count({
        where: { OR: [{ user_id: id }, { checked_out_by: id }, { checked_in_by: id }] },
      })) +
      (await db.vehicle_checkouts.count({
        where: { OR: [{ user_id: id }, { checked_out_by: id }, { checked_in_by: id }] },
      }));
    if (history > 0) {
      // Preserva o histórico: em vez de apagar, bloqueia o acesso.
      await db.profiles.update({
        where: { id },
        data: { approved: false, token_version: { increment: 1 }, password_hash: "" },
      });
      await db.push_subscriptions.deleteMany({ where: { user_id: id } });
    } else {
      await db.profiles.delete({ where: { id } });
    }
    await logAction({
      action: history > 0 ? "user_deactivated" : "user_deleted",
      entity_type: "user",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { deleted_user: user.full_name, email: user.email, kept_history: history > 0 },
    });
    return c.json({ success: true, deactivated: history > 0 });
  });
