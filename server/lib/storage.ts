import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de imagens.
 *
 * - Produção: Vercel Blob com acesso privado (BLOB_READ_WRITE_TOKEN).
 * - Desenvolvimento sem token: grava em `.data/uploads` no disco local.
 *
 * O banco guarda apenas o "path" relativo (ex.: `veiculos/saidas/2026-05-01/x.jpg`),
 * igual ao que era guardado no bucket "imagens" do Supabase.
 */

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.resolve(process.cwd(), ".data/uploads");

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // limite de corpo da Vercel é 4.5 MB

/**
 * Confere pelos primeiros bytes se o conteúdo é mesmo uma imagem do tipo
 * declarado (o tipo enviado pelo navegador não é confiável).
 */
export function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  const ascii = (i: number, text: string) => at(i, ...[...text].map((ch) => ch.charCodeAt(0)));
  switch (contentType) {
    case "image/jpeg":
      return at(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "image/heic":
    case "image/heif":
      return ascii(4, "ftyp");
    default:
      return false;
  }
}

/** Valida o formato do path para evitar travessia de diretório. */
export function isSafeStoragePath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    p.length > 0 &&
    p.length < 512 &&
    !p.includes("..") &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    /^[\w\-./]+$/.test(p)
  );
}

export async function putFile(storagePath: string, body: ArrayBuffer | Buffer, contentType: string) {
  if (blobEnabled()) {
    await put(storagePath, Buffer.from(body as ArrayBuffer), {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return;
  }
  const full = path.join(LOCAL_DIR, storagePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(body as ArrayBuffer));
}

export async function getFile(
  storagePath: string,
): Promise<{ body: ReadableStream<Uint8Array> | Buffer; contentType: string; size?: number } | null> {
  if (blobEnabled()) {
    const result = await get(storagePath, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  }
  try {
    const buf = await readFile(path.join(LOCAL_DIR, storagePath));
    const ext = path.extname(storagePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { body: buf, contentType, size: buf.length };
  } catch {
    return null;
  }
}

export async function deleteFiles(paths: string[]) {
  const valid = paths.filter(isSafeStoragePath);
  if (valid.length === 0) return;
  if (blobEnabled()) {
    await del(valid);
    return;
  }
  await Promise.all(valid.map((p) => rm(path.join(LOCAL_DIR, p), { force: true })));
}

export function slugifyForFile(input: string | null | undefined, fallback = "arquivo"): string {
  return (
    (input || fallback)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
}
