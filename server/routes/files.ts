import { Hono } from "hono";
import { isAdmin, requireAdmin, type AuthVars } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { badRequest, forbidden, notFound } from "../lib/http.js";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  deleteFiles,
  getFile,
  isSafeStoragePath,
  putFile,
  slugifyForFile,
} from "../lib/storage.js";
import { CHECKIN_PHOTO_COLUMNS, CHECKOUT_PHOTO_COLUMNS } from "../services/vehicleCheckouts.js";

const MODULES = ["ferramentas", "veiculos"] as const;
const DIRECTIONS = ["saidas", "entradas", "problemas"] as const;

/** Verifica se o usuário pode ver o arquivo: admin, quem enviou, ou retirada vinculada a ele. */
async function canView(userId: string, admin: boolean, path: string) {
  if (admin) return true;
  const file = await db.uploaded_files.findUnique({ where: { path } });
  if (file?.owner_id === userId) return true;

  const toolMatch = await db.tool_checkouts.findFirst({
    where: {
      user_id: userId,
      OR: ["checkout_photo_url", "checkin_photo_url", "checkout_signature_url", "checkin_signature_url"].map((c) => ({
        [c]: path,
      })),
    },
    select: { id: true },
  });
  if (toolMatch) return true;
  const vehicleMatch = await db.vehicle_checkouts.findFirst({
    where: { user_id: userId, OR: [...CHECKOUT_PHOTO_COLUMNS, ...CHECKIN_PHOTO_COLUMNS].map((c) => ({ [c]: path })) },
    select: { id: true },
  });
  return !!vehicleMatch;
}

export const fileRoutes = new Hono<{ Variables: AuthVars }>()
  /**
   * Upload de uma imagem (multipart: file, module, direction, prefix?, asset_name?).
   * O path é gerado no servidor no mesmo padrão usado antes no bucket "imagens".
   */
  .post("/", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) throw badRequest("Arquivo não enviado");
    if (file.size === 0) throw badRequest("Arquivo vazio");
    if (file.size > MAX_UPLOAD_BYTES) throw badRequest("Imagem muito grande (máximo 4 MB)");
    const contentType = file.type || "image/jpeg";
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) throw badRequest("Formato de imagem não suportado");

    const module = String(form.get("module") || "");
    const direction = String(form.get("direction") || "");
    if (!MODULES.includes(module as (typeof MODULES)[number])) throw badRequest("Módulo inválido");
    if (!DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])) throw badRequest("Direção inválida");

    const prefix = slugifyForFile(String(form.get("prefix") || "foto"), "foto").replace(/-/g, "_");
    const fallbackName = direction === "saidas" ? "saida" : direction === "entradas" ? "entrada" : "problema";
    const slug = slugifyForFile(String(form.get("asset_name") || ""), fallbackName);
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const ymd = dateFolder.replace(/-/g, "");
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const rand = crypto.randomUUID().slice(0, 8);
    const path = `${module}/${direction}/${dateFolder}/${slug}_${ymd}_${prefix}_${rand}.${ext}`;

    await putFile(path, await file.arrayBuffer(), contentType);
    await db.uploaded_files.create({
      data: { path, owner_id: user.id, content_type: contentType, size: file.size },
    });
    return c.json({ path }, 201);
  })

  /** Lista uma "pasta" (admin) — emula a listagem do Storage do Supabase. */
  .get("/list", requireAdmin, async (c) => {
    const prefix = (c.req.query("prefix") || "").replace(/^\/+|\/+$/g, "");
    if (prefix && !isSafeStoragePath(prefix)) throw badRequest("Pasta inválida");
    const base = prefix ? `${prefix}/` : "";
    const rows = await db.uploaded_files.findMany({
      where: { path: { startsWith: base } },
      orderBy: { created_at: "desc" },
      take: 20000,
    });
    const folders = new Set<string>();
    const files: { id: string; name: string; created_at: Date; metadata: { size: number | null } }[] = [];
    for (const r of rows) {
      const rest = r.path.slice(base.length);
      const slash = rest.indexOf("/");
      if (slash >= 0) folders.add(rest.slice(0, slash));
      else files.push({ id: r.path, name: rest, created_at: r.created_at, metadata: { size: r.size } });
    }
    return c.json({
      folders: [...folders].sort().reverse().map((name) => ({ name, id: null })),
      files,
    });
  })

  /** Busca recursiva por nome de arquivo ou nome/placa do veículo (admin). */
  .get("/search", requireAdmin, async (c) => {
    const prefix = (c.req.query("prefix") || "").replace(/^\/+|\/+$/g, "");
    const q = (c.req.query("q") || "").trim();
    if (!q) return c.json([]);
    const base = prefix ? `${prefix}/` : "";
    const byName = await db.uploaded_files.findMany({
      where: { path: { startsWith: base, contains: q, mode: "insensitive" } },
      take: 500,
      orderBy: { created_at: "desc" },
    });
    const paths = new Map(byName.map((f) => [f.path, f]));

    const vehicles = await db.vehicles.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { plate: { contains: q, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (vehicles.length) {
      const rows = await db.vehicle_checkouts.findMany({
        where: { vehicle_id: { in: vehicles.map((v) => v.id) } },
        take: 500,
      });
      for (const row of rows) {
        const rec = row as unknown as Record<string, string | null>;
        for (const col of [...CHECKOUT_PHOTO_COLUMNS, ...CHECKIN_PHOTO_COLUMNS]) {
          const p = rec[col];
          if (p && p.startsWith(base) && !paths.has(p)) {
            paths.set(p, { path: p, owner_id: null, content_type: null, size: null, created_at: row.checkout_date });
          }
        }
      }
    }
    return c.json(
      [...paths.values()].map((f) => ({
        id: f.path,
        name: f.path.split("/").pop(),
        _rel: f.path.slice(base.length),
        created_at: f.created_at,
        metadata: { size: f.size },
      })),
    );
  })

  /** Dados da retirada de veículo vinculada a uma foto (admin). */
  .get("/meta", requireAdmin, async (c) => {
    const path = c.req.query("path") || "";
    if (!isSafeStoragePath(path)) throw badRequest("Caminho inválido");
    const row = await db.vehicle_checkouts.findFirst({
      where: { OR: [...CHECKOUT_PHOTO_COLUMNS, ...CHECKIN_PHOTO_COLUMNS].map((col) => ({ [col]: path })) },
      include: { vehicle: { select: { name: true, plate: true } }, user: { select: { full_name: true } } },
    });
    if (!row) return c.json(null);
    return c.json({
      id: row.id,
      checkout_date: row.checkout_date,
      checkin_date: row.checkin_date,
      destination: row.destination,
      vehicles: row.vehicle,
      profiles: row.user,
    });
  })

  .delete("/", requireAdmin, async (c) => {
    const path = c.req.query("path") || "";
    if (!isSafeStoragePath(path)) throw badRequest("Caminho inválido");
    await deleteFiles([path]);
    await db.uploaded_files.deleteMany({ where: { path } });
    return c.json({ success: true });
  })

  /** Serve a imagem (privada) com checagem de permissão. */
  .get("/*", async (c) => {
    const user = c.get("user");
    const path = decodeURIComponent(c.req.path.replace(/^\/api\/files\//, ""));
    if (!isSafeStoragePath(path)) throw badRequest("Caminho inválido");
    if (!(await canView(user.id, isAdmin(user), path))) throw forbidden();
    const file = await getFile(path);
    if (!file) throw notFound("Arquivo não encontrado");
    return c.body(file.body as ReadableStream, 200, {
      "Content-Type": file.contentType,
      // Conteúdo imutável (paths únicos), mas privado: só o navegador do usuário guarda.
      "Cache-Control": "private, max-age=86400, immutable",
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
    });
  });
