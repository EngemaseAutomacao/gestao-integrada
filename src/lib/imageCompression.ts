/** Fotos menores que isso já estão leves e vão como estão. */
const SKIP_BELOW_BYTES = 400 * 1024;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.75;

/**
 * Compress an image file/blob before uploading.
 * Reduces 3-5MB camera photos to ~200-400KB.
 */
export async function compressImage(
  file: File | Blob,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  return await canvas.convertToBlob({ type: "image/jpeg", quality });
}

/**
 * Compress a base64 data URL and return a new compressed data URL.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1920,
  quality = 0.8
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const compressed = await compressImage(blob, maxWidth, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}

/**
 * Reduz fotos grandes (lado maior até 1600 px, JPEG) antes do envio. Se o
 * navegador não conseguir decodificar (ex.: HEIC) ou o resultado não ficar
 * menor, devolve o original.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  if (file.size < SKIP_BELOW_BYTES) return file;
  try {
    const compressed = await compressImage(file, MAX_SIDE, JPEG_QUALITY);
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}
