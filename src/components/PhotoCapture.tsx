import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, RotateCcw, Check } from "lucide-react";

interface PhotoCaptureProps {
  onCapture: (photoDataUrl: string) => void;
  title?: string;
}

export function PhotoCapture({ onCapture, title = "Foto da Ferramenta" }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop any existing stream first to avoid conflicts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      // Try rear camera first, fallback to any camera
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        // Fallback: try without facingMode constraint
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      // Set capturing state first so video element renders
      setStream(mediaStream);
      setIsCapturing(true);

      // Wait for next render cycle so videoRef is available
      await new Promise(resolve => setTimeout(resolve, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("autoplay", "true");
        try {
          await videoRef.current.play();
        } catch {
          // play() can fail on some browsers, autoplay attribute handles it
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMsg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Permissão da câmera negada. Vá nas configurações do navegador e permita o acesso à câmera."
        : "Não foi possível acessar a câmera. Verifique as permissões do navegador.";
      setError(errorMsg);
      setIsCapturing(false);
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);


  const retake = () => {
    setCapturedPhoto(null);
    setError(null);
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {isCapturing ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Foto capturada"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Camera className="w-12 h-12 mb-2" />
              <p className="text-sm">Nenhuma foto capturada</p>
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
          )}
        </div>
        
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2">
          {!isCapturing && !capturedPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Abrir Câmera
              </Button>
          )}
          
          {isCapturing && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={capturePhoto}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capturar
              </Button>
            </>
          )}
          
          {capturedPhoto && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retake}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refazer
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmPhoto}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
