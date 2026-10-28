import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { loadUser, requireAuth, type AuthVars } from "./lib/auth.js";
import { Prisma } from "./lib/db.js";
import { HttpError, forbidden } from "./lib/http.js";
import { adminRoutesMount } from "./routes/index.js";

export const app = new Hono<{ Variables: AuthVars }>().basePath("/api");

app.use(secureHeaders({ crossOriginResourcePolicy: "same-origin" }));

/**
 * Proteção CSRF: a sessão é um cookie, então toda requisição que altera dados
 * precisa do header X-Requested-With (formulários de outros sites não conseguem
 * enviá-lo sem CORS). O Vercel Cron só usa GET.
 */
app.use(async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && c.req.header("x-requested-with") !== "engemase") {
    throw forbidden("Requisição inválida");
  }
  await next();
});

/**
 * Limite de tamanho do corpo: dados comuns são pequenos; só o envio de fotos
 * (/api/files) precisa de mais. Barra requisições gigantes feitas para gastar
 * memória do servidor na validação.
 */
app.use(async (c, next) => {
  const maxSize = c.req.path.startsWith("/api/files") ? 5 * 1024 * 1024 : 512 * 1024;
  return bodyLimit({ maxSize, onError: (ctx) => ctx.json({ error: "Requisição muito grande" }, 413) })(c, next);
});

app.get("/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.use(loadUser);

// Rotas públicas (login, cadastro, cron) ficam antes do requireAuth.
adminRoutesMount(app, requireAuth);

app.notFound((c) => c.json({ error: "Rota não encontrada" }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, ...(err.details && err.status !== 400 ? { details: err.details } : {}) }, err.status as 400);
  }
  if (err instanceof ZodError) {
    return c.json({ error: err.issues[0]?.message ?? "Dados inválidos" }, 400);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return c.json({ error: "Registro duplicado" }, 409);
    if (err.code === "P2025") return c.json({ error: "Registro não encontrado" }, 404);
    if (err.code === "P2003") return c.json({ error: "Existem registros vinculados" }, 409);
  }
  console.error(`[api] ${c.req.method} ${c.req.path} falhou:`, err);
  return c.json({ error: "Erro interno. Tente novamente." }, 500);
});
