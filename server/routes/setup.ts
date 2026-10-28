import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { logAction } from "../lib/audit.js";
import { HttpError, forbidden, unauthorized } from "../lib/http.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";
import { importExportFile, type ExportFile } from "../services/importExport.js";

/**
 * Importação única dos dados do sistema antigo pela página /importar.
 * Só funciona enquanto a variável IMPORT_SECRET estiver definida na Vercel —
 * remova-a depois da migração para desativar esta rota.
 */
const secretMatches = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const setupRoutes = new Hono()
  .get("/status", (c) => c.json({ importEnabled: (process.env.IMPORT_SECRET ?? "").length >= 20 }))

  .post("/import", async (c) => {
    const expected = process.env.IMPORT_SECRET ?? "";
    if (expected.length < 20) throw forbidden("Importação desativada");
    await enforceRateLimit(`setup-import:${clientIp(c.req.raw.headers)}`, 5, 600);
    if (!secretMatches(c.req.header("x-import-secret") ?? "", expected)) throw unauthorized("Código de importação incorreto");

    let data: ExportFile;
    try {
      data = await c.req.json();
    } catch {
      throw new HttpError(400, "Arquivo inválido: use o engemase-export.json");
    }
    let result: Record<string, string>;
    try {
      result = await importExportFile(data);
    } catch (err) {
      console.error("[setup/import] falhou:", err);
      throw new HttpError(400, err instanceof Error ? err.message : "Falha na importação");
    }
    await logAction({
      action: "data_import",
      entity_type: "system",
      user_name: "Importação do sistema antigo",
      details: { result },
    });
    return c.json({ success: true, result });
  });
