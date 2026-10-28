import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { HttpError, badRequest, forbidden, unauthorized } from "../lib/http.js";
import { clientIp, enforceRateLimit } from "../lib/rateLimit.js";
import sharp from "sharp";
import { deleteFiles, getFile, isSafeStoragePath, putFile } from "../lib/storage.js";
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
  })

  /**
   * TEMPORÁRIO: comprime as fotos importadas antes da compressão no app
   * (estouraram o 1 GB do Blob). Como o Blob recusa gravações acima da cota,
   * roda em duas fases sem risco de perda:
   *  1. guarda a versão comprimida no banco e só então apaga a original;
   *  2. com espaço livre, grava as comprimidas de volta no Blob.
   * Chamar repetidamente até phase = "done".
   */
  .get("/compress-photos", async (c) => {
    requireImportSecret(c.req.query("token"));
    const started = Date.now();
    const timeLeft = () => Date.now() - started < 45_000;
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS photo_compress_tmp (path text PRIMARY KEY, data bytea NOT NULL)`,
    );
    const failed: string[] = [];
    let stashed = 0;
    let restored = 0;

    // Fase 1: comprime e guarda no banco; só depois apaga a original do Blob.
    const pending = await db.$queryRawUnsafe<{ path: string }[]>(
      `SELECT f.path FROM uploaded_files f
        WHERE f.size > 614400 AND f.content_type = 'image/jpeg'
          AND NOT EXISTS (SELECT 1 FROM photo_compress_tmp t WHERE t.path = f.path)
        ORDER BY f.size DESC`,
    );
    for (const { path } of pending) {
      if (!timeLeft()) break;
      try {
        const file = await getFile(path);
        if (!file) throw new Error("não encontrada no Blob");
        const original = Buffer.isBuffer(file.body)
          ? file.body
          : Buffer.from(await new Response(file.body as ReadableStream).arrayBuffer());
        const small = await sharp(original)
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75, mozjpeg: true })
          .toBuffer();
        if (small.length >= original.length) {
          await db.uploaded_files.update({ where: { path }, data: { size: original.length } });
          continue;
        }
        await db.$executeRawUnsafe(
          `INSERT INTO photo_compress_tmp (path, data) VALUES ($1, $2) ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data`,
          path,
          small,
        );
        await deleteFiles([path]);
        stashed++;
      } catch (err) {
        failed.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Fase 2: depois que todas as originais grandes saíram, grava as comprimidas.
    const left = pending.length - stashed - failed.length;
    if (left <= 0 && timeLeft()) {
      const rows = await db.$queryRawUnsafe<{ path: string }[]>(`SELECT path FROM photo_compress_tmp`);
      for (const { path } of rows) {
        if (!timeLeft()) break;
        try {
          const [row] = await db.$queryRawUnsafe<{ data: Buffer }[]>(
            `SELECT data FROM photo_compress_tmp WHERE path = $1`,
            path,
          );
          const data = Buffer.from(row.data);
          await putFile(path, data, "image/jpeg");
          await db.uploaded_files.update({ where: { path }, data: { size: data.length } });
          await db.$executeRawUnsafe(`DELETE FROM photo_compress_tmp WHERE path = $1`, path);
          restored++;
        } catch (err) {
          failed.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const [{ count: waiting }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) FROM photo_compress_tmp`,
    );
    const remainingBig = await db.uploaded_files.count({
      where: { size: { gt: 614400 }, content_type: "image/jpeg" },
    });
    const phase = Number(waiting) === 0 && remainingBig - failed.length <= 0 ? "done" : "running";
    return c.json({ phase, stashed, restored, waiting: Number(waiting), remainingBig, failed });
  });
