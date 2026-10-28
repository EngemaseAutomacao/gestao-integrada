/**
 * Compress an image file/blob before uploading.
 * Reduces 3-5MB camera photos to ~300-500KB.
 */
export async function compressImage(
  file: File | Blob,
  maxWidth = 1920,
  quality = 0.8
): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / img.width);
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
