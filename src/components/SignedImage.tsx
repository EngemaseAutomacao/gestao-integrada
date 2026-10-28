import { useSignedUrl } from "@/hooks/useSignedUrl";

interface SignedImageProps {
  storagePath: string | null | undefined;
  alt: string;
  className?: string;
  bucket?: string;
}

export function SignedImage({ storagePath, alt, className }: SignedImageProps) {
  const url = useSignedUrl(storagePath);
  if (!storagePath || !url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
