import type { Context } from "hono";
import { z } from "zod";

/** Erro com status HTTP e mensagem segura para exibir ao usuário. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = "Não autenticado") => new HttpError(401, msg);
export const forbidden = (msg = "Acesso negado") => new HttpError(403, msg);
export const notFound = (msg = "Registro não encontrado") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Lê e valida o corpo JSON com zod; erros viram 400 com a primeira mensagem. */
export async function parseBody<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest("Corpo da requisição inválido");
  }
  return parseWith(schema, raw);
}

export function parseQuery<T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  return parseWith(schema, c.req.query());
}

export function parseWith<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first?.message ?? "Dados inválidos", result.error.flatten());
  }
  return result.data;
}

export const uuid = z.string().uuid("ID inválido");

/** Converte string vazia em null — útil para campos opcionais de formulário. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));
