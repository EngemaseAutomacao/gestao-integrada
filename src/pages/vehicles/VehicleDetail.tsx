import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Car, History, Calendar, MapPin, Clock, PlugZap } from "lucide-react";
import { ModuleHero } from "@/components/ModuleHero";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

interface Vehicle {
  id: string;
  name: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  status: string | null;
  image_url: string | null;
  vehicle_type?: string | null;
  is_charging?: boolean | null;
}

interface ChargingSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  started_by_name: string;
  ended_by_name: string | null;
}

function formatDuration(startISO: string, endISO: string | null): string {
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  const ms = end - new Date(startISO).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

interface CheckoutRecord {
  id: string;
  checkout_date: string;
  checkin_date: string | null;
  status: string | null;
  destination: string | null;
  km_checkout: number;
  km_checkin: number | null;
  notes: string | null;
  user_profile: {
    full_name: string;
    email: string;
  };
}



const severityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["vehicle-detail", id],
    queryFn: async () => {
      const [vehicle, checkouts, users, sessions] = await Promise.all([
        api.get<Vehicle>(`/vehicles/${id}`),
        api.get<CheckoutRecord[]>(`/vehicles/${id}/checkouts`),
        api.get<{ id: string; full_name: string }[]>("/users/approved"),
        api.get<any[]>(`/vehicles/${id}/charging-sessions`),
      ]);
      const userMap = new Map<string, string>();
      users.forEach((u) => userMap.set(u.id, u.full_name));
      const chargingSessions: ChargingSession[] = sessions.map((s) => ({
        id: s.id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        started_by_name: userMap.get(s.started_by) || "—",
        ended_by_name: s.ended_by ? userMap.get(s.ended_by) || "—" : null,
      }));
      return {
        vehicle: vehicle as Vehicle | null,
        checkouts,
        chargingSessions,
      };
    },
    enabled: !!id,
    meta: { errorMessage: "Erro ao carregar dados" },
  });

  const vehicle = data?.vehicle ?? null;
  const checkouts = data?.checkouts ?? [];
  const chargingSessions = data?.chargingSessions ?? [];

  const getDaysUsed = (checkout: CheckoutRecord) => {
    const start = new Date(checkout.checkout_date);
    const end = checkout.checkin_date ? new Date(checkout.checkin_date) : new Date();
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (!loading && !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Car className="w-8 h-8" />
        <p>Veículo não encontrado.</p>
      </div>
    );
  }

  if (loading || !vehicle) {
    return (
      <div className="flex items-center justify-center h-full">
        <Car className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  const isAvailable = vehicle.status === "available";

  return (
    <div className="flex flex-col gap-4 md:gap-6 h-full min-h-0 pb-2">
      <ModuleHero
        eyebrow="Módulo · Veículos"
        title={vehicle.name}
        subtitle="Detalhes e histórico completo"
        floating={
          <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Placa</p>
                <Badge variant="secondary" className="text-xs font-mono mt-1">{vehicle.plate}</Badge>
              </div>
              {vehicle.brand && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Marca</p>
                  <p className="text-sm font-medium mt-1">{vehicle.brand}</p>
                </div>
              )}
              {vehicle.model && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Modelo</p>
                  <p className="text-sm font-medium mt-1">{vehicle.model}</p>
                </div>
              )}
              {vehicle.color && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cor</p>
                  <p className="text-sm font-medium mt-1">{vehicle.color}</p>
                </div>
              )}
              {vehicle.year && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Ano</p>
                  <p className="text-sm font-medium mt-1">{vehicle.year}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                <Badge className={`mt-1 ${isAvailable ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                  {isAvailable ? "Disponível" : "Em uso"}
                </Badge>
              </div>
            </div>
          </div>
        }
      />


      {/* Charging History — só para plataformas */}
      {vehicle.vehicle_type === "platform" && (
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <PlugZap className="w-4 h-4 md:w-5 md:h-5 text-info" />
              Histórico de Carregamento
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {chargingSessions.length} sessão(ões) registrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2">
            {chargingSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Nenhuma sessão de carregamento registrada
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {chargingSessions.map((s) => {
                  const ongoing = !s.ended_at;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg border p-3 text-xs md:text-sm ${
                        ongoing ? "border-info/40 bg-info/5" : "bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={ongoing ? "default" : "secondary"}
                            className={ongoing ? "bg-info text-info-foreground" : ""}
                          >
                            {ongoing ? "Em andamento" : "Finalizada"}
                          </Badge>
                          <span className="font-mono text-muted-foreground">
                            {formatDuration(s.started_at, s.ended_at)}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(s.started_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Colocou para carregar
                          </p>
                          <p className="font-medium">{s.started_by_name}</p>
                          <p className="text-muted-foreground">
                            {format(new Date(s.started_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Retirou da carga
                          </p>
                          {s.ended_at ? (
                            <>
                              <p className="font-medium">{s.ended_by_name}</p>
                              <p className="text-muted-foreground">
                                {format(new Date(s.ended_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            </>
                          ) : (
                            <p className="text-muted-foreground italic">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checkout History */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="p-4 md:p-6 shrink-0">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <History className="w-4 h-4 md:w-5 md:h-5" />
            Histórico de Uso
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {checkouts.length} registros de uso
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0 flex-1 min-h-0 overflow-y-auto">

          {checkouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum uso registrado</p>
          ) : (
            <div className="space-y-3">
              {checkouts.map((checkout) => (
                <Card key={checkout.id}>
                  <CardContent className="p-3 md:p-4">
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm md:text-base truncate">{checkout.user_profile?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{checkout.user_profile?.email}</p>
                        </div>
                        <Badge variant={checkout.status === "checked_out" ? "default" : "secondary"} className="text-xs">
                          {checkout.status === "checked_out" ? "Em Uso" : "Devolvido"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-muted-foreground">Saída</p>
                            <p>{format(new Date(checkout.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                          </div>
                        </div>
                        {checkout.checkin_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-muted-foreground">Devolução</p>
                              <p>{format(new Date(checkout.checkin_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
                        {checkout.destination && (
                          <div className="flex items-start gap-1.5 w-full min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="break-words min-w-0 flex-1">{checkout.destination}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{getDaysUsed(checkout)} dias</span>
                        </div>
                        {vehicle.vehicle_type === "platform" ? (
                          <span className="text-muted-foreground">
                            Horímetro: {checkout.checkin_date ? formatDuration(checkout.checkout_date, checkout.checkin_date) : "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">KM: {checkout.km_checkout}{checkout.km_checkin ? ` → ${checkout.km_checkin}` : ""}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
