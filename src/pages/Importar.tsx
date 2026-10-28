import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { unzip } from "fflate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, CheckCircle2, Images } from "lucide-react";
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

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const PARALLEL_UPLOADS = 4;

/**
 * Acha o path do bucket "imagens" dentro do ZIP, aceitando pastas extras na
 * frente (ex.: "imagens/veiculos/..." ou "backup/ferramentas/...").
 */
function storagePathFromZipEntry(name: string): string | null {
  if (name.endsWith("/") || name.includes("__MACOSX") || !IMAGE_EXT.test(name)) return null;
  const match = name.match(/(?:^|\/)((?:veiculos|ferramentas)\/.+)$/);
  return match ? match[1] : null;
}

function unzipAsync(data: Uint8Array) {
  return new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(err) : resolve(files))),
  );
}

interface PhotoProgress {
  total: number;
  done: number;
  imported: number;
  existing: number;
  failed: string[];
  finished: boolean;
}

/**
 * Importação única dos dados e das fotos do sistema antigo (Lovable). Só
 * funciona enquanto a variável IMPORT_SECRET estiver configurada na Vercel.
 */
export default function Importar() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoProgress | null>(null);

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

  const uploadPhoto = async (path: string, bytes: Uint8Array) => {
    const res = await fetch("/api/setup/import-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Requested-With": "engemase",
        "X-Import-Secret": secret.trim(),
        "X-File-Path": encodeURIComponent(path),
      },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data.status as "imported" | "exists";
  };

  const handlePhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile || !secret.trim()) {
      toast.error("Informe o código e escolha o arquivo ZIP");
      return;
    }
    setLoading(true);
    try {
      const entries = await unzipAsync(new Uint8Array(await zipFile.arrayBuffer()));
      const queue = Object.entries(entries)
        .map(([name, bytes]) => ({ path: storagePathFromZipEntry(name), bytes }))
        .filter((f): f is { path: string; bytes: Uint8Array } => !!f.path);
      if (queue.length === 0) throw new Error("Nenhuma foto encontrada no ZIP (pastas veiculos/ ou ferramentas/)");

      // Confere o código antes de disparar centenas de envios.
      const first = await uploadPhoto(queue[0].path, queue[0].bytes);
      const progress: PhotoProgress = {
        total: queue.length,
        done: 1,
        imported: first === "imported" ? 1 : 0,
        existing: first === "exists" ? 1 : 0,
        failed: [],
        finished: false,
      };
      setPhotos({ ...progress });

      let next = 1;
      const worker = async () => {
        while (next < queue.length) {
          const item = queue[next++];
          try {
            const status = await uploadPhoto(item.path, item.bytes);
            if (status === "exists") progress.existing++;
            else progress.imported++;
          } catch (err) {
            progress.failed.push(`${item.path}: ${err instanceof Error ? err.message : "erro"}`);
          }
          progress.done++;
          setPhotos({ ...progress });
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, worker));
      progress.finished = true;
      setPhotos({ ...progress });
      if (progress.failed.length) toast.warning(`${progress.failed.length} foto(s) não foram enviadas`);
      else toast.success("Fotos importadas com sucesso!");
    } catch (err) {
      toast.error("Não foi possível importar as fotos", {
        description: err instanceof Error ? err.message : undefined,
      });
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
            Traga os dados (<strong>engemase-export.json</strong>) e as fotos (<strong>ZIP</strong> do bucket
            imagens). Pode repetir sem duplicar nada.
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
          ) : (
            <div className="space-y-6">
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

              <section className="space-y-3">
                <h3 className="font-medium">1. Dados</h3>
                {result ? (
                  <div className="space-y-2">
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
                  </div>
                ) : (
                  <form onSubmit={handleImport} className="space-y-3">
                    <Input
                      id="file"
                      type="file"
                      aria-label="Arquivo engemase-export.json"
                      accept=".json,application/json"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Importar dados
                    </Button>
                  </form>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-medium">2. Fotos</h3>
                {photos ? (
                  <div className="space-y-2">
                    <Progress value={(photos.done / photos.total) * 100} />
                    <p className="text-sm">
                      {photos.done}/{photos.total} fotos processadas · {photos.imported} novas · {photos.existing} já
                      existiam
                      {photos.failed.length > 0 && ` · ${photos.failed.length} com erro`}
                    </p>
                    {photos.finished && photos.failed.length > 0 && (
                      <ul className="text-xs text-destructive max-h-32 overflow-auto space-y-0.5">
                        {photos.failed.map((f) => (
                          <li key={f} className="break-all">
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {photos.finished && (
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <CheckCircle2 className="h-5 w-5" /> Envio de fotos concluído
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handlePhotos} className="space-y-3">
                    <Input
                      id="zip"
                      type="file"
                      aria-label="Arquivo ZIP com as fotos"
                      accept=".zip,application/zip"
                      onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Images className="mr-2 h-4 w-4" />}
                      {loading ? "Enviando fotos…" : "Importar fotos"}
                    </Button>
                  </form>
                )}
              </section>

              <Button asChild className="w-full">
                <Link to="/auth">Ir para o login</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
