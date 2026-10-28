import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOffline } from "@/contexts/OfflineContext";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Clock, Image, AlertTriangle, X, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOfflinePhotosCount } from "@/hooks/useOfflinePhotos";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function OfflineIndicator() {
  const { isOnline, pendingOperations, failedOperations, syncPendingOperations, dismissFailedOperation, retryFailedOperation } = useOffline();
  const [offlinePhotosCount, setOfflinePhotosCount] = useState(0);

  useEffect(() => {
    const checkPhotos = async () => {
      try {
        const count = await getOfflinePhotosCount();
        setOfflinePhotosCount(count);
      } catch { setOfflinePhotosCount(0); }
    };
    checkPhotos();
    const interval = setInterval(checkPhotos, 10000);
    return () => clearInterval(interval);
  }, [pendingOperations]);

  const totalPending = pendingOperations.length + failedOperations.length;

  if (isOnline && totalPending === 0 && offlinePhotosCount === 0) {
    return null;
  }

  const opLabel = (type: string) => {
    const labels: Record<string, string> = {
      checkout: "Retirada de ferramenta",
      checkin: "Devolução de ferramenta",
      vehicle_checkout: "Saída de veículo",
      vehicle_checkin: "Chegada de veículo",
    };
    return labels[type] || type;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-orange-500" />
          )}
          {totalPending > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5">
              {totalPending}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Online</p>
                  <p className="text-xs text-muted-foreground">Conectado à internet</p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Modo Offline</p>
                  <p className="text-xs text-muted-foreground">
                    Suas operações serão sincronizadas quando reconectar
                  </p>
                </div>
              </>
            )}
          </div>

          {pendingOperations.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Pendentes ({pendingOperations.length})
                </p>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {pendingOperations.map((op) => (
                  <li key={op.id} className="flex items-start gap-2">
                    <span className="inline-block w-2 h-2 mt-1 rounded-full bg-orange-500" />
                    <span>
                      {opLabel(op.type)}
                      {op.retryCount > 0 && ` (tentativa ${op.retryCount}/${5})`}
                    </span>
                  </li>
                ))}
              </ul>
              {offlinePhotosCount > 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Image className="h-3 w-3" />
                  <span>{offlinePhotosCount} foto(s) salva(s) localmente</span>
                </div>
              )}
            </div>
          )}

          {failedOperations.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  Falhas permanentes ({failedOperations.length})
                </p>
              </div>
              <ul className="space-y-2 text-xs">
                {failedOperations.map((op) => (
                  <li key={op.id} className="flex items-start justify-between gap-2 bg-destructive/10 rounded p-2">
                    <div>
                      <span className="font-medium">{opLabel(op.type)}</span>
                      {op.lastError && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{op.lastError}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Tentar novamente"
                        disabled={!isOnline}
                        onClick={() => retryFailedOperation(op.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Descartar"
                        onClick={() => dismissFailedOperation(op.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOnline && pendingOperations.length > 0 && (
            <Button size="sm" className="w-full" onClick={syncPendingOperations}>
              Sincronizar Agora
            </Button>
          )}

          {totalPending > 0 && (
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link to="/pendencias">
                <ExternalLink className="h-3 w-3" /> Ver Pendências
              </Link>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
