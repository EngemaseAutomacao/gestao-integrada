import { db } from "./db.js";
import { HttpError } from "./http.js";

/**
 * Limite de requisições em janela fixa, persistido em `rate_limits` (funciona
 * entre instâncias serverless). Usa upsert atômico, sem corrida de leitura/escrita.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  let count: number;
  try {
    const row = await db.rate_limits.upsert({
      where: { bucket_key_window_start: { bucket_key: key, window_start: windowStart } },
      create: { bucket_key: key, window_start: windowStart, request_count: 1 },
      update: { request_count: { increment: 1 } },
      select: { request_count: true },
    });
    count = row.request_count;
  } catch (err) {
    // Falha no limitador não deve derrubar a aplicação.
    console.error("[rateLimit] falhou, liberando requisição:", err);
    return;
  }

  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000));
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns instantes e tente novamente.", {
      retry_after_seconds: retryAfter,
    });
  }
}

/**
 * IP do cliente. Na Vercel, `x-vercel-forwarded-for`/`x-real-ip` são definidos
 * pela própria plataforma; o `x-forwarded-for` pode trazer valores enviados pelo
 * cliente na frente, então fica só como último recurso (dev local).
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
