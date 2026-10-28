import { api } from "@/lib/api";
import { shrinkPhoto } from "@/lib/imageCompression";

/**
 * Convert a base64 data URL to a Blob
 */
export const dataUrlToBlob = (dataUrl: string, mimeType: string): Blob => {
  const byteArray = Uint8Array.from(atob(dataUrl.split(",")[1]), c => c.charCodeAt(0));
  return new Blob([byteArray], { type: mimeType });
};

type Module = "ferramentas" | "veiculos";
type Direction = "saidas" | "entradas" | "problemas";

/** Envia um arquivo para /api/files; o servidor gera o path final e devolve. */
const uploadBlob = async (
  blob: Blob,
  fileName: string,
  opts: { module: Module; direction: Direction; prefix: string; assetName?: string },
): Promise<string> => {
  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("module", opts.module);
  form.append("direction", opts.direction);
  form.append("prefix", opts.prefix);
  if (opts.assetName) form.append("asset_name", opts.assetName);
  const { path } = await api.post<{ path: string }>("/files", form);
  return path;
};

/**
 * Upload an image (from data URL)
 * Used for tool checkout/checkin photos and signatures
 */
export const uploadDataUrlImage = async (
  dataUrl: string,
  type: "photo" | "signature",
  module: Module,
  direction: Direction
): Promise<string | null> => {
  try {
    const mimeType = type === "photo" ? "image/jpeg" : "image/png";
    const ext = type === "photo" ? "jpg" : "png";
    const raw = dataUrlToBlob(dataUrl, mimeType);
    const blob = type === "photo" ? await shrinkPhoto(raw) : raw;
    return await uploadBlob(blob, `${type}.${ext}`, { module, direction, prefix: type });
  } catch (error) {
    console.error(`Error uploading ${type}:`, error);
    return null;
  }
};

/**
 * Slugify a name for safe filename usage (lowercase, no accents, no spaces).
 */
export const slugifyForFile = (input: string): string => {
  return (input || "veiculo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "veiculo";
};

/**
 * Upload a File object
 * Used for vehicle checkout/checkin photos
 * Filename pattern (gerado no servidor): {assetSlug}_{yyyymmdd}_{prefix}_{id}.{ext}
 */
export const uploadFileImage = async (
  file: File,
  prefix: string,
  module: Module,
  direction: "saidas" | "entradas",
  assetName?: string
): Promise<string> => {
  const blob = await shrinkPhoto(file);
  const name = blob === file ? file.name || "foto.jpg" : "foto.jpg";
  return uploadBlob(blob, name, { module, direction, prefix, assetName });
};

/**
 * Extrai o path interno a partir de uma URL antiga do Supabase Storage ou
 * retorna o próprio valor se já for um path.
 */
export function extractStoragePath(url: string): string {
  const patterns: RegExp[] = [
    /\/object\/(?:public|sign)\/imagens\/(.+?)(\?.*)?$/,
    /\/imagens\/(.+?)(\?.*)?$/,
    /^\/api\/files\/(.+?)(\?.*)?$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return decodeURIComponent(match[1]);
  }
  return url;
}
