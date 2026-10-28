import { Button, ButtonProps } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { shareContent, vibrate, VibrationPatterns, type SharePayload } from "@/lib/pwa";

interface ShareButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  payload: SharePayload;
  label?: string;
  successMessage?: string;
}

/**
 * Botão que usa Web Share API quando disponível; senão copia para a área de transferência.
 */
export function ShareButton({
  payload,
  label = "Compartilhar",
  successMessage = "Compartilhado!",
  variant = "outline",
  size = "sm",
  ...rest
}: ShareButtonProps) {
  const handleClick = async () => {
    const ok = await shareContent(payload);
    if (ok) {
      vibrate(VibrationPatterns.tap);
      toast.success(successMessage);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} {...rest}>
      <Share2 className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
