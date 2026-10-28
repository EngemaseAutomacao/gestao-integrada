import { api } from "@/lib/api";
import { shrinkPhoto } from "@/lib/imageCompression";

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
