import bcrypt from "bcryptjs";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import type { profiles } from "../generated/prisma/client.js";
import { db } from "./db.js";
import { forbidden, unauthorized } from "./http.js";

const COOKIE_NAME = "engemase_session";
const LONG_SESSION_DAYS = 30;
/** Sessões "não manter conectado" expiram mesmo que o navegador mantenha o cookie. */
const SHORT_SESSION_HOURS = 12;

export type PublicProfile = Omit<profiles, "password_hash" | "token_version">;

export type AuthVars = {
  user: PublicProfile;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou muito curto (mínimo 32 caracteres)");
  }
  return new TextEncoder().encode(secret);
}

export function toPublicProfile(p: profiles): PublicProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, token_version, ...rest } = p;
  return rest;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

/**
 * Compara a senha com o hash. Os hashes migrados do Supabase Auth são bcrypt
 * ($2a$/$2b$), então funcionam sem que os usuários precisem redefinir a senha.
 */
export const verifyPassword = (password: string, hash: string) =>
  hash ? bcrypt.compare(password, hash) : Promise.resolve(false);

export async function createSession(c: Context, user: profiles, keepConnected: boolean) {
  const expiresIn = keepConnected ? `${LONG_SESSION_DAYS}d` : `${SHORT_SESSION_HOURS}h`;
  const token = await new SignJWT({ tv: user.token_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
    sameSite: "Lax",
    path: "/",
    // Sem maxAge => cookie de sessão (some ao fechar o navegador).
    ...(keepConnected ? { maxAge: LONG_SESSION_DAYS * 24 * 60 * 60 } : {}),
  });
}

export function clearSession(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

async function readSession(c: Context): Promise<profiles | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = await db.profiles.findUnique({ where: { id: payload.sub } });
    if (!user) return null;
    // Troca de senha / reset pelo admin incrementa token_version e derruba sessões antigas.
    if ((payload.tv ?? 0) !== user.token_version) return null;
    return user;
  } catch {
    return null;
  }
}

/** Carrega o usuário (se houver) sem exigir login. */
export const loadUser: MiddlewareHandler<{ Variables: Partial<AuthVars> }> = async (c, next) => {
  const user = await readSession(c);
  if (user) c.set("user", toPublicProfile(user));
  await next();
};

/** Exige usuário autenticado e aprovado. */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (!user.approved) throw forbidden("Seu cadastro ainda aguarda aprovação de um administrador");
  await next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw forbidden("Acesso restrito a administradores");
  await next();
};

export const isAdmin = (user: Pick<PublicProfile, "role"> | undefined | null) => user?.role === "admin";
