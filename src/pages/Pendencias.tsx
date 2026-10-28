import { useState } from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OP_LABELS: Record<string, string> = {
  checkout: "Retirada de ferramenta",
  checkin: "Devolução de ferramenta",
  vehicle_checkout: "Saída de veículo",
  vehicle_checkin: "Chegada de veículo",
};

export default function Pendencias() {
  const {
    isOnline,
    pendingOperations,
    failedOperations,
    syncPendingOperations,
    dismissFailedOperation,
    retryFailedOperation,
  } = useOffline();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPendingOperations();
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (ts: number) =>
    format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const totalAll = pendingOperations.length + failedOperations.length;

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pendências de Sincronização</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" /> Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-orange-500" /> Sem conexão
              </>
            )}
          </p>
        </div>
        {pendingOperations.length > 0 && isOnline && (
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        )}
      </div>

      {totalAll === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">Tudo sincronizado!</p>
            <p className="text-sm mt-1">
              Nenhuma operação aguardando envio ao servidor.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingOperations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-orange-500" />
              Aguardando envio ({pendingOperations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingOperations.map((op) => (
              <div
                key={op.id}
                className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {OP_LABELS[op.type] || op.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {fmt(op.timestamp)}
                  </p>
                  {op.retryCount > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Tentativa {op.retryCount}/5
                      {op.lastError ? ` — ${op.lastError}` : ""}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">Pendente</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {failedOperations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Falhas ({failedOperations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {failedOperations.map((op) => (
              <div
                key={op.id}
                className="flex flex-col gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/5"
              >
                <div>
                  <p className="font-medium text-sm">
                    {OP_LABELS[op.type] || op.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {fmt(op.timestamp)}
                  </p>
                  {op.lastError && (
                    <p className="text-xs text-destructive mt-1 break-words">
                      Motivo: {op.lastError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dismissFailedOperation(op.id)}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Descartar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => retryFailedOperation(op.id)}
                    disabled={!isOnline}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Tentar novamente
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
