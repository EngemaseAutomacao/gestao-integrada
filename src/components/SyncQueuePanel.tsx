import { useState } from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger 
} from "@/components/ui/sheet";
import { 
  RefreshCw, Clock, CheckCircle2, XCircle, Loader2, 
  Wrench, Car, AlertTriangle, LogIn, LogOut, ChevronRight 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OP_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  checkout: { label: "Retirada de ferramenta", icon: <LogOut className="w-4 h-4 text-orange-500" /> },
  checkin: { label: "Devolução de ferramenta", icon: <LogIn className="w-4 h-4 text-green-500" /> },
  vehicle_checkout: { label: "Saída de veículo", icon: <Car className="w-4 h-4 text-orange-500" /> },
  vehicle_checkin: { label: "Chegada de veículo", icon: <Car className="w-4 h-4 text-green-500" /> },
};

export function SyncQueuePanel() {
  const { isOnline, pendingOperations, syncPendingOperations } = useOffline();
  const [syncing, setSyncing] = useState(false);

  if (pendingOperations.length === 0) return null;

  const handleSync = async () => {
    setSyncing(true);
    await syncPendingOperations();
    setSyncing(false);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-orange-500/50 text-orange-600 dark:text-orange-400"
        >
          <Clock className="w-4 h-4" />
          {pendingOperations.length} pendente(s)
          <ChevronRight className="w-3 h-3" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[400px] md:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-500" />
            Fila de Sincronização
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {pendingOperations.length} operação(ões) pendente(s)
              </p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? "Pronto para sincronizar" : "Aguardando conexão"}
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={handleSync} 
              disabled={!isOnline || syncing}
              className="gap-2"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar
            </Button>
          </div>

          <div className="space-y-2">
            {pendingOperations.map((op) => {
              const opInfo = OP_LABELS[op.type] || { label: op.type, icon: <Wrench className="w-4 h-4" /> };
              return (
                <Card key={op.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{opInfo.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{opInfo.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(op.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                        {op.data?.tool_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ferramenta: {op.data.tool_name}
                          </p>
                        )}
                        {op.data?.vehicle_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Veículo: {op.data.vehicle_name}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Clock className="w-3 h-3 mr-1" />
                        Pendente
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
