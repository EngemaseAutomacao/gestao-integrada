import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ModuleHero } from "@/components/ModuleHero";
import { Loader2, Car, User, Calendar, LogIn, Search, AlertTriangle, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface VehicleInUseRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  checkout_date: string;
  estimated_return_date: string | null;
  destination: string | null;
  purpose: string | null;
  km_checkout: number;
  notes: string | null;
  vehicles: { name: string; plate: string } | null;
  profiles: { full_name: string; username: string | null } | null;
}

export default function AdminVehiclesInUse() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [returnTarget, setReturnTarget] = useState<VehicleInUseRow | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [kmCheckin, setKmCheckin] = useState("");
  const [loading, setLoading] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["admin-vehicles-in-use"],
    queryFn: async () => {
      return api.get<VehicleInUseRow[]>("/vehicle-checkouts", { status: "checked_out" });
    },
  });

  const rows = (data || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.vehicles?.name?.toLowerCase().includes(q) ||
      r.vehicles?.plate?.toLowerCase().includes(q) ||
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.profiles?.username?.toLowerCase().includes(q) ||
      r.destination?.toLowerCase().includes(q)
    );
  });

  const handleReturn = async () => {
    if (!returnTarget || !profile?.id) return;
    const trimmed = returnNotes.trim();
    if (trimmed.length < 5) {
      toast.error("Justificativa obrigatória (mín. 5 caracteres).");
      return;
    }

    let kmValue: number | null = null;
    if (kmCheckin.trim()) {
      const parsed = parseInt(kmCheckin.trim(), 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error("KM de chegada inválido.");
        return;
      }
      if (parsed < returnTarget.km_checkout) {
        toast.error("KM de chegada não pode ser menor que o KM de saída.", {
          description: `KM de saída: ${returnTarget.km_checkout}`,
        });
        return;
      }
      kmValue = parsed;
    }

    setLoading(true);
    try {
      // O servidor acrescenta a justificativa às observações e libera o veículo.
      const justification = `[Devolução manual pelo admin ${profile.full_name || profile.username || "admin"} em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}] ${trimmed}`;
      await api.post(`/vehicle-checkouts/${returnTarget.id}/checkin`, {
        notes: justification,
        km_checkin: kmValue,
        km_checkin_automatic: false,
      });
      toast.success("Devolução registrada com sucesso.");
      setReturnTarget(null);
      setReturnNotes("");
      setKmCheckin("");
      queryClient.invalidateQueries({ queryKey: ["admin-vehicles-in-use"] });
    } catch (err: any) {
      toast.error("Erro ao registrar devolução", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (profile && profile.role !== "admin") return <Navigate to="/" />;
  return (
    <div className="animate-fade-in">
      <ModuleHero
        eyebrow="Módulo · Administração"
        title="Veículos em Uso"
        subtitle="Todos os veículos atualmente em uso e seus responsáveis"
      />
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por veículo, placa, usuário ou destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="whitespace-nowrap">
            {rows.length} em uso
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhum veículo em uso no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const overdue =
                row.estimated_return_date &&
                new Date(row.estimated_return_date) < new Date();
              return (
                <Card key={row.id} className="overflow-hidden">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Car className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm sm:text-base truncate">
                            {row.vehicles?.name || "Veículo"}
                          </span>
                          {row.vehicles?.plate && (
                            <Badge variant="outline" className="text-xs">
                              {row.vehicles.plate}
                            </Badge>
                          )}
                          {overdue && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" /> Atrasado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {row.profiles?.full_name || "Usuário"}
                            {row.profiles?.username && (
                              <span className="ml-1 opacity-70">@{row.profiles.username}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                          <Calendar className="h-3.5 w-3.5" />
                          Saída em{" "}
                          {format(new Date(row.checkout_date), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                          {row.estimated_return_date && (
                            <>
                              {" · "}
                              Previsão:{" "}
                              {format(new Date(row.estimated_return_date), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </>
                          )}
                          {" · "}
                          KM saída: {row.km_checkout}
                        </div>
                        {row.destination && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">
                              Destino: <span className="text-foreground">{row.destination}</span>
                            </span>
                          </div>
                        )}
                        {row.notes && (
                          <div className="text-xs bg-muted/50 rounded-md p-2 mt-1 whitespace-pre-wrap">
                            {row.notes}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReturnTarget(row);
                          setReturnNotes("");
                          setKmCheckin("");
                        }}
                        className="gap-1.5 shrink-0"
                      >
                        <LogIn className="h-4 w-4" />
                        Devolver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!returnTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReturnTarget(null);
            setReturnNotes("");
            setKmCheckin("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver veículo</DialogTitle>
            <DialogDescription>
              Você vai devolver{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.vehicles?.name}
              </span>{" "}
              em nome de{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.profiles?.full_name}
              </span>
              . A ação ficará registrada em seu nome.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="km-checkin">
                KM de chegada (opcional) — KM de saída: {returnTarget?.km_checkout}
              </Label>
              <Input
                id="km-checkin"
                type="number"
                inputMode="numeric"
                value={kmCheckin}
                onChange={(e) => setKmCheckin(e.target.value)}
                placeholder="Ex.: 125430"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-notes">Justificativa (mín. 5 caracteres)</Label>
              <Textarea
                id="return-notes"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={4}
                placeholder="Ex.: usuário devolveu o veículo sem registrar no app"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnTarget(null);
                setReturnNotes("");
                setKmCheckin("");
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleReturn} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
