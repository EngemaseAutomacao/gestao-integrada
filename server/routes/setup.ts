import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { HttpError, badRequest, forbidden, unauthorized } from "../lib/http.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";
import { deleteFiles, isSafeStoragePath, putFile } from "../lib/storage.js";
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

const MAX_IMPORT_BYTES = 4.4 * 1024 * 1024; // limite de corpo da Vercel é 4.5 MB

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function requireImportSecret(given: string | undefined) {
  const expected = process.env.IMPORT_SECRET ?? "";
  if (expected.length < 20) throw forbidden("Importação desativada");
  if (!secretMatches(given ?? "", expected)) throw unauthorized("Código de importação incorreto");
}

export const setupRoutes = new Hono()
  .get("/status", (c) => c.json({ importEnabled: (process.env.IMPORT_SECRET ?? "").length >= 20 }))

  .post("/import", async (c) => {
    if ((process.env.IMPORT_SECRET ?? "").length < 20) throw forbidden("Importação desativada");
    await enforceRateLimit(`setup-import:${clientIp(c.req.raw.headers)}`, 5, 600);
    requireImportSecret(c.req.header("x-import-secret"));

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
  })

  /**
   * Envia uma foto do bucket antigo "imagens" (uma por requisição, por causa do
   * limite de 4.5 MB da Vercel). O path é o mesmo gravado nas retiradas.
   */
  .post("/import-file", async (c) => {
    if ((process.env.IMPORT_SECRET ?? "").length < 20) throw forbidden("Importação desativada");
    await enforceRateLimit(`setup-import-file:${clientIp(c.req.raw.headers)}`, 3000, 600);
    requireImportSecret(c.req.header("x-import-secret"));
    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new HttpError(503, "Armazenamento de fotos (Vercel Blob) não configurado");
    }

    const path = decodeURIComponent(c.req.header("x-file-path") ?? "");
    if (!isSafeStoragePath(path)) throw badRequest("Caminho de arquivo inválido");
    const contentType = CONTENT_TYPES[path.split(".").pop()?.toLowerCase() ?? ""];
    if (!contentType) throw badRequest("Tipo de arquivo não suportado");

    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) throw badRequest("Arquivo vazio");
    if (body.byteLength > MAX_IMPORT_BYTES) throw new HttpError(413, "Arquivo maior que 4,4 MB");

    // Com X-Replace, uma versão comprimida substitui a foto já enviada se for menor.
    const existing = await db.uploaded_files.findUnique({ where: { path }, select: { size: true } });
    const replace = c.req.header("x-replace") === "1";
    if (existing && !(replace && existing.size != null && body.byteLength < existing.size)) {
      return c.json({ status: "exists" });
    }
    if (existing) {
      await deleteFiles([path]);
      await db.uploaded_files.delete({ where: { path } });
    }

    try {
      await putFile(path, body, contentType);
    } catch (err) {
      // Envio anterior chegou ao Blob mas não ao banco: substitui.
      if (!/already exists/i.test(String(err))) throw err;
      await deleteFiles([path]);
      await putFile(path, body, contentType);
    }
    await db.uploaded_files.create({
      data: { path, owner_id: null, content_type: contentType, size: body.byteLength },
    });
    return c.json({ status: existing ? "replaced" : "imported" });
  });
