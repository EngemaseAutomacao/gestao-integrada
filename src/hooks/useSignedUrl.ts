import { useMemo } from "react";
import { fileUrl } from "@/lib/api";
import { extractStoragePath } from "@/lib/storageUtils";

/**
 * URL para exibir uma imagem guardada. As imagens agora são servidas por
 * /api/files com o cookie de sessão — não é mais preciso gerar URL assinada.
 * O nome do hook foi mantido para não mexer nos componentes que o usam.
 */
export function useSignedUrl(path: string | null | undefined, _overrideBucket?: string) {
  return useMemo(() => (path ? fileUrl(extractStoragePath(path)) : null), [path]);
}

export function useSignedUrls(urls: (string | null | undefined)[], _overrideBucket?: string) {
  const key = JSON.stringify(urls);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => urls.map((u) => (u ? fileUrl(extractStoragePath(u)) : null)), [key]);
}
