import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Database, Trash2, Save, Loader2, Image, Clock, FileText, Bell, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface RetentionSetting {
  id: string;
  setting_key: string;
  label: string;
  description: string | null;
  retention_days: number;
  enabled: boolean;
  updated_at: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  tool_checkout_photos: <Image className="w-5 h-5 text-orange-500" />,
  vehicle_checkout_photos: <Image className="w-5 h-5 text-blue-500" />,
  tool_checkout_history: <Clock className="w-5 h-5 text-green-500" />,
  vehicle_checkout_history: <Clock className="w-5 h-5 text-purple-500" />,
  notifications: <Bell className="w-5 h-5 text-yellow-500" />,
  system_logs: <FileText className="w-5 h-5 text-red-500" />,
  
};

const PRESET_OPTIONS = [
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
  { label: "180 dias", value: 180 },
  { label: "1 ano", value: 365 },
  { label: "2 anos", value: 730 },
];

export default function AdminDataRetention() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<RetentionSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);

  // Limpeza automática agendada todo dia às 03:00 (horário do servidor)
  const { daysUntilNextCleanup, nextCleanupLabel } = (() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const diffMs = next.getTime() - now.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const label = `${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às 03:00`;
    return { daysUntilNextCleanup: days, nextCleanupLabel: label };
  })();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      setSettings(await api.get<RetentionSetting[]>("/retention"));
    } catch {
      toast.error("Erro ao carregar configurações");
    }
    setLoading(false);
  };

  if (profile?.role !== "admin") {
    return <Navigate to="/" />;
  }

  const updateSetting = async (id: string, updates: Partial<RetentionSetting>) => {
    setSaving(id);
    try {
      await api.patch(`/retention/${id}`, {
        enabled: updates.enabled,
        retention_days: updates.retention_days,
      });
      setSettings(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      toast.success("Configuração salva");
    } catch (error) {
      toast.error("Erro ao salvar configuração", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
    setSaving(null);
  };

  const handleToggle = (setting: RetentionSetting) => {
    updateSetting(setting.id, { enabled: !setting.enabled });
  };

  const handleDaysChange = (setting: RetentionSetting, days: number) => {
    if (days < 1) return;
    setSettings(prev => prev.map(s => s.id === setting.id ? { ...s, retention_days: days } : s));
  };

  const saveDays = (setting: RetentionSetting) => {
    updateSetting(setting.id, { retention_days: setting.retention_days });
  };

  const runCleanup = async () => {
    setRunningCleanup(true);
    try {
      const { results } = await api.post<{ results: Record<string, number> }>("/retention/run");
      const total = Object.values(results || {}).reduce((a, b) => a + b, 0);
      toast.success("Limpeza executada com sucesso!", {
        description: `${total} registro(s) afetado(s).`,
      });
    } catch {
      toast.error("Erro ao executar limpeza");
    }
    setRunningCleanup(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHero icon={Database} title="Retenção de Dados" subtitle="Configure por quanto tempo os dados são mantidos no sistema" />
      <div className="flex justify-end gap-4 flex-wrap">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={runningCleanup} className="gap-2">
              {runningCleanup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Executar Limpeza Agora
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Limpeza</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá remover permanentemente todos os dados que excederam o período de retenção configurado.
                Apenas as categorias com limpeza <strong>ativada</strong> serão afetadas.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={runCleanup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar Limpeza
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-4">
        {settings.map((setting) => (
          <Card key={setting.id} className={`transition-all ${setting.enabled ? "border-orange-500/30" : "opacity-75"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {ICON_MAP[setting.setting_key] || <Database className="w-5 h-5 text-muted-foreground" />}
                  <div>
                    <CardTitle className="text-base">{setting.label}</CardTitle>
                    {setting.description && (
                      <CardDescription className="text-xs mt-0.5">{setting.description}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={setting.enabled ? "default" : "secondary"} className="text-xs">
                    {setting.enabled ? "Ativa" : "Desativada"}
                  </Badge>
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={() => handleToggle(setting)}
                    disabled={saving === setting.id}
                  />
                </div>
              </div>
            </CardHeader>
            {setting.enabled && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRESET_OPTIONS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={setting.retention_days === preset.value ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          handleDaysChange(setting, preset.value);
                          updateSetting(setting.id, { retention_days: preset.value });
                        }}
                        disabled={saving === setting.id}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Personalizado:</Label>
                    <Input
                      type="number"
                      min={1}
                      value={setting.retention_days}
                      onChange={(e) => handleDaysChange(setting, parseInt(e.target.value) || 1)}
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">dias</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1"
                      onClick={() => saveDays(setting)}
                      disabled={saving === setting.id}
                    >
                      {saving === setting.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dados criados hoje serão removidos em <strong>{new Date(Date.now() + setting.retention_days * 86400000).toLocaleDateString("pt-BR")}</strong> ({setting.retention_days} dias).
                  </p>

                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
