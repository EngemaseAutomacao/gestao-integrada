import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Bell, Check, X, Shield } from "lucide-react";

interface PermissionItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "granted" | "denied";
}

export function PermissionsRequest() {
  const [dismissed, setDismissed] = useState(false);
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      key: "camera",
      label: "Câmera",
      description: "Para capturar fotos de ferramentas e veículos",
      icon: <Camera className="w-5 h-5" />,
      status: "pending",
    },
    {
      key: "notifications",
      label: "Notificações",
      description: "Para receber alertas e atualizações do sistema",
      icon: <Bell className="w-5 h-5" />,
      status: "pending",
    },
  ]);

  useEffect(() => {
    const alreadyAsked = localStorage.getItem("engemase_permissions_asked");
    if (alreadyAsked) {
      setDismissed(true);
      return;
    }
    checkCurrentPermissions();
  }, []);

  const checkCurrentPermissions = async () => {
    const updated = [...permissions];

    // Check notification permission
    if ("Notification" in window) {
      const notifPerm = Notification.permission;
      const notifIdx = updated.findIndex((p) => p.key === "notifications");
      if (notifPerm === "granted") updated[notifIdx].status = "granted";
      else if (notifPerm === "denied") updated[notifIdx].status = "denied";
    }

    // Check camera permission
    try {
      const camPerm = await navigator.permissions.query({ name: "camera" as PermissionName });
      const camIdx = updated.findIndex((p) => p.key === "camera");
      if (camPerm.state === "granted") updated[camIdx].status = "granted";
      else if (camPerm.state === "denied") updated[camIdx].status = "denied";
    } catch {}


    setPermissions(updated);

    // If all already granted, auto-dismiss
    if (updated.every((p) => p.status === "granted")) {
      setDismissed(true);
      localStorage.setItem("engemase_permissions_asked", "true");
    }
  };

  const requestAll = async () => {
    const updated = [...permissions];

    // Request camera
    const camIdx = updated.findIndex((p) => p.key === "camera");
    if (updated[camIdx].status === "pending") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        updated[camIdx].status = "granted";
      } catch {
        updated[camIdx].status = "denied";
      }
    }


    // Request notifications
    const notifIdx = updated.findIndex((p) => p.key === "notifications");
    if (updated[notifIdx].status === "pending") {
      try {
        const result = await Notification.requestPermission();
        updated[notifIdx].status = result === "granted" ? "granted" : "denied";
      } catch {
        updated[notifIdx].status = "denied";
      }
    }

    setPermissions(updated);
    localStorage.setItem("engemase_permissions_asked", "true");
    
    setTimeout(() => setDismissed(true), 1500);
  };

  const handleDismiss = () => {
    localStorage.setItem("engemase_permissions_asked", "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  const hasPending = permissions.some((p) => p.status === "pending");

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-xl border-2">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Permissões Necessárias</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Para funcionar corretamente, o app precisa das seguintes permissões:
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {permissions.map((perm) => (
            <div
              key={perm.key}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  perm.status === "granted"
                    ? "bg-green-500/10 text-green-600"
                    : perm.status === "denied"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {perm.status === "granted" ? (
                  <Check className="w-5 h-5" />
                ) : perm.status === "denied" ? (
                  <X className="w-5 h-5" />
                ) : (
                  perm.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{perm.label}</p>
                <p className="text-xs text-muted-foreground">{perm.description}</p>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-2">
            {hasPending ? (
              <Button onClick={requestAll} className="w-full" size="lg">
                Permitir Acesso
              </Button>
            ) : (
              <Button onClick={handleDismiss} className="w-full" size="lg">
                <Check className="w-4 h-4 mr-2" />
                Continuar
              </Button>
            )}
            {hasPending && (
              <Button variant="ghost" onClick={handleDismiss} size="sm" className="text-muted-foreground">
                Pular por agora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
