import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PhotoAngle {
  key: string;
  label: string;
}

const BASE_ANGLES: PhotoAngle[] = [
  { key: "front", label: "Frente" },
  { key: "back", label: "Traseira" },
  { key: "left", label: "Lado Esquerdo" },
  { key: "right", label: "Lado Direito" },
];

const DASHBOARD_ANGLE: PhotoAngle = { key: "dashboard", label: "Painel do Veículo" };

const INTERIOR_ANGLES: PhotoAngle[] = [
  { key: "interior_front", label: "Interior Dianteiro" },
  { key: "interior_back", label: "Interior Traseiro" },
];

const PLATFORM_EXTRA_ANGLES: PhotoAngle[] = [
  { key: "control", label: "Controle da Plataforma" },
  { key: "wheel_fl", label: "Roda Dianteira Esquerda" },
  { key: "wheel_fr", label: "Roda Dianteira Direita" },
  { key: "wheel_rl", label: "Roda Traseira Esquerda" },
  { key: "wheel_rr", label: "Roda Traseira Direita" },
];

export type VehicleKind = "vehicle" | "platform";

interface VehiclePhotoCaptureProps {
  photos: Record<string, File | null>;
  previews: Record<string, string | null>;
  onPhotoChange: (key: string, file: File | null, preview: string | null) => void;
  includeDashboard?: boolean;
  vehicleType?: VehicleKind;
  allowGallery?: boolean;
}

export function getRequiredPhotoKeys(vehicleType: VehicleKind = "vehicle", includeDashboard = false): string[] {
  if (vehicleType === "platform") {
    return [...BASE_ANGLES.map(a => a.key), ...PLATFORM_EXTRA_ANGLES.map(a => a.key)];
  }
  return [
    ...BASE_ANGLES.map(a => a.key),
    ...(includeDashboard ? [DASHBOARD_ANGLE.key] : []),
    ...INTERIOR_ANGLES.map(a => a.key),
  ];
}

export default function VehiclePhotoCapture({ previews, onPhotoChange, includeDashboard = false, vehicleType = "vehicle", allowGallery = false }: VehiclePhotoCaptureProps) {
  const ANGLES: PhotoAngle[] = vehicleType === "platform"
    ? [...BASE_ANGLES, ...PLATFORM_EXTRA_ANGLES]
    : [...BASE_ANGLES, ...(includeDashboard ? [DASHBOARD_ANGLE] : []), ...INTERIOR_ANGLES];

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onPhotoChange(key, file, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const allCaptured = ANGLES.every((a) => previews[a.key]);

  const headerLabel = vehicleType === "platform"
    ? "Fotos da Plataforma (4 lados + controle + 4 rodas)"
    : `Fotos do Veículo (${includeDashboard ? "4 ângulos + painel + interior" : "4 ângulos + interior"})`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{headerLabel} *</Label>
        {allCaptured && (
          <span className="text-sm text-success flex items-center gap-1">
            <Check className="w-4 h-4" /> Todas capturadas
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ANGLES.map((angle) => (
          <div key={angle.key} className="space-y-1">
            <Label className="text-sm">{angle.label}</Label>
            <input
              ref={(el) => { inputRefs.current[angle.key] = el; }}
              type="file"
              accept="image/*"
              {...(allowGallery ? {} : { capture: "environment" as const })}
              className="hidden"
              onChange={(e) => handleFileChange(angle.key, e)}
            />
            {previews[angle.key] ? (
              <div className="relative">
                <img
                  src={previews[angle.key]!}
                  alt={angle.label}
                  className="w-full h-28 object-cover rounded-lg border cursor-pointer"
                  onClick={() => setEnlargedImage(previews[angle.key]!)}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => {
                    onPhotoChange(angle.key, null, null);
                    if (inputRefs.current[angle.key]) inputRefs.current[angle.key]!.value = "";
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-28 flex flex-col gap-1 border-dashed"
                onClick={() => {
                  if (inputRefs.current[angle.key]) {
                    inputRefs.current[angle.key]!.value = "";
                  }
                  inputRefs.current[angle.key]?.click();
                }}
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tirar foto</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto do veículo</DialogTitle>
          </DialogHeader>
          {enlargedImage && (
            <img src={enlargedImage} alt="Foto ampliada" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { BASE_ANGLES as ANGLES };
