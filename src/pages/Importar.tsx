import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import engemaseLogo from "@/assets/engemase-logo.png";

const TABLE_LABELS: Record<string, string> = {
  profiles: "Usuários",
  tools: "Ferramentas",
  vehicles: "Veículos",
  construction_sites: "Obras",
  tool_checkouts: "Retiradas de ferramentas",
  vehicle_checkouts: "Saídas de veículos",
  vehicle_charging_sessions: "Sessões de carga",
  push_subscriptions: "Inscrições de notificação",
  notifications: "Notificações",
  system_logs: "Logs",
  sync_state: "Sincronizações",
};

/**
 * Importação única dos dados do sistema antigo (Lovable). Só funciona enquanto
 * a variável IMPORT_SECRET estiver configurada na Vercel.
 */
export default function Importar() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.importEnabled))
      .catch(() => setEnabled(false));
  }, []);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !secret.trim()) {
      toast.error("Informe o código e escolha o arquivo");
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/setup/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "engemase",
          "X-Import-Secret": secret.trim(),
        },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setResult(data.result);
      toast.success("Dados importados com sucesso!");
    } catch (err) {
      toast.error("Não foi possível importar", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-40">
            <img src={engemaseLogo} alt="Engemase Engenharia" className="w-full h-auto" />
          </div>
          <CardTitle className="text-2xl">Importar dados do sistema antigo</CardTitle>
          <CardDescription>
            Envie o arquivo <strong>engemase-export.json</strong> para trazer usuários, ferramentas, veículos e
            histórico. Pode repetir sem duplicar nada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enabled === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !enabled ? (
            <p className="text-sm text-muted-foreground text-center">
              A importação está desativada. <Link to="/auth" className="text-primary underline">Ir para o login</Link>
            </p>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-medium">
                <CheckCircle2 className="h-5 w-5" /> Importação concluída
              </div>
              <ul className="text-sm space-y-1">
                {Object.entries(result).map(([table, value]) => (
                  <li key={table} className="flex justify-between border-b border-border/50 py-1">
                    <span>{TABLE_LABELS[table] ?? table}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                “importados/total”. Na repetição, 0 significa que já estavam no sistema.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleImport} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secret">Código de importação</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo engemase-export.json</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {loading ? "Importando… (pode levar 1 minuto)" : "Importar dados"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
