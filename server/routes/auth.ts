import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  clearSession,
  createSession,
  hashPassword,
  requireAuth,
  toPublicProfile,
  verifyPassword,
  type AuthVars,
} from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { HttpError, badRequest, conflict, parseBody, unauthorized } from "../lib/http.js";
import { adminIds, createNotifications, dispatchPushInBackground } from "../lib/notify.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";

const GENERIC_LOGIN_ERROR = "Usuário ou senha inválidos";
// Hash fixo usado quando o usuário não existe, para o tempo de resposta não revelar isso.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("senha-inexistente-para-tempo-constante"));

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(128, "A senha deve ter no máximo 128 caracteres");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.]{3,30}$/, "Nome de usuário deve ter 3-30 caracteres (letras minúsculas, números e ponto)");

export const categorySchema = z.enum(["engemase_employee", "third_party", "socios"], {
  error: "Categoria inválida",
});

/** A troca de senha precisa funcionar mesmo antes da aprovação (primeiro acesso). */
const requireAuthAllowUnapproved: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  if (!c.get("user")) throw unauthorized();
  await next();
};

export const authRoutes = new Hono<{ Variables: AuthVars }>()
  .post("/login", async (c) => {
    await enforceRateLimit(`login:${clientIp(c.req.raw.headers)}`, 10, 60);
    const body = await parseBody(
      c,
      z.object({
        username: z.string().trim().min(1).max(254),
        password: z.string().min(1).max(200),
        keepConnected: z.boolean().optional().default(true),
      }),
    ).catch(() => {
      throw new HttpError(400, GENERIC_LOGIN_ERROR);
    });

    // Aceita usuário ou e-mail.
    const login = body.username.toLowerCase();
    // Limite por conta além do limite por IP: barra tentativas espalhadas em vários IPs.
    await enforceRateLimit(`login-user:${login}`, 10, 600);
    const user = await db.profiles.findFirst({
      where: login.includes("@") ? { email: { equals: login, mode: "insensitive" } } : { username: login },
    });
    const ok = await verifyPassword(body.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new HttpError(401, GENERIC_LOGIN_ERROR);

    const updated = await db.profiles.update({ where: { id: user.id }, data: { last_sign_in_at: new Date() } });
    await createSession(c, updated, body.keepConnected);
    return c.json({ profile: toPublicProfile(updated) });
  })

  .post("/logout", (c) => {
    clearSession(c);
    return c.json({ success: true });
  })

  .get("/me", async (c) => {
    const user = c.get("user");
    if (!user) throw unauthorized();
    // Registra acesso no máximo a cada 10 minutos (antes: rpc touch_last_access).
    const last = user.last_access_at ? new Date(user.last_access_at).getTime() : 0;
    if (Date.now() - last > 10 * 60 * 1000) {
      await db.profiles.update({ where: { id: user.id }, data: { last_access_at: new Date() } }).catch(() => {});
    }
    return c.json({ profile: user });
  })

  .post("/register", async (c) => {
    await enforceRateLimit(`register:${clientIp(c.req.raw.headers)}`, 5, 600);
    const body = await parseBody(
      c,
      z.object({
        fullName: z.string().trim().min(2, "Nome completo deve ter entre 2 e 100 caracteres").max(100),
        username: usernameSchema,
        password: passwordSchema,
        category: categorySchema,
      }),
    );

    const email = `${body.username}@engemase.local`;
    const exists = await db.profiles.findFirst({
      where: { OR: [{ username: body.username }, { email }] },
      select: { id: true },
    });
    if (exists) throw conflict("Este nome de usuário já está em uso");

    const profile = await db.profiles.create({
      data: {
        email,
        username: body.username,
        full_name: body.fullName,
        category: body.category,
        role: body.category === "third_party" ? "third_party" : "employee",
        approved: false,
        first_login: false,
        password_hash: await hashPassword(body.password),
      },
    });

    await logAction({
      action: "user_registered",
      entity_type: "user",
      entity_id: profile.id,
      user_id: profile.id,
      user_name: profile.full_name,
      details: { email: profile.email, category: profile.category },
    });
    const admins = await adminIds();
    await createNotifications(
      admins.map((id) => ({
        user_id: id,
        type: "new_user",
        title: "Novo cadastro aguardando aprovação",
        message: `${profile.full_name} (${profile.username}) solicitou acesso ao sistema.`,
      })),
    );
    dispatchPushInBackground();
    return c.json({ success: true }, 201);
  })

  .post("/change-password", requireAuthAllowUnapproved, async (c) => {
    const user = c.get("user");
    await enforceRateLimit(`change-password:${user.id}`, 10, 600);
    const body = await parseBody(
      c,
      z.object({
        currentPassword: z.string().max(200).optional(),
        newPassword: passwordSchema
          .regex(/[a-z]/, "A senha deve conter letra minúscula")
          .regex(/[A-Z]/, "A senha deve conter letra maiúscula")
          .regex(/[0-9]/, "A senha deve conter número"),
      }),
    );
    const full = await db.profiles.findUniqueOrThrow({ where: { id: user.id } });

    // Senha atual é exigida, exceto na troca obrigatória do primeiro acesso.
    if (!full.first_login) {
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, full.password_hash))) {
        throw badRequest("Senha atual incorreta");
      }
    }
    if (await verifyPassword(body.newPassword, full.password_hash)) {
      throw badRequest("A nova senha não pode ser igual à senha atual.");
    }

    const updated = await db.profiles.update({
      where: { id: user.id },
      data: {
        password_hash: await hashPassword(body.newPassword),
        first_login: false,
        token_version: { increment: 1 },
      },
    });
    // Mantém o usuário logado nesta sessão (as demais são encerradas).
    await createSession(c, updated, true);
    await logAction({
      action: "password_changed",
      entity_type: "user",
      entity_id: user.id,
      user_id: user.id,
      user_name: user.full_name,
    });
    return c.json({ profile: toPublicProfile(updated) });
  })

  .patch("/me", requireAuth, async (c) => {
    const user = c.get("user");
    const body = await parseBody(
      c,
      // Só o que a própria pessoa pode mudar. first_login sai apenas pela troca
      // de senha (senão daria para pular a troca obrigatória após um reset).
      z.strictObject({ onboarding_completed: z.literal(true).optional() }, { error: "Campo não permitido" }),
    );
    const updated = await db.profiles.update({ where: { id: user.id }, data: body });
    return c.json({ profile: toPublicProfile(updated) });
  });

