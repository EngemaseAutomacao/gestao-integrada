import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, ArrowRight, ChevronDown, Search, FileText, FileSpreadsheet, Filter, X, Plug, PlugZap } from "lucide-react";
import { ModuleHero } from "@/components/ModuleHero";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

export default function VehicleDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleCharging = async (vehicleId: string, next: boolean) => {
    setTogglingId(vehicleId);
    try {
      await api.post(`/vehicles/${vehicleId}/charging`, { is_charging: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o status de carga");
      return;
    } finally {
      setTogglingId(null);
    }
    toast.success(next ? "Veículo marcado como carregando" : "Carregamento finalizado");
    queryClient.invalidateQueries({ queryKey: ["vehicles-list-dashboard"] });
  };

  const [myVehiclesExpanded, setMyVehiclesExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const { data: stats } = useQuery({
    queryKey: ["vehicle-stats"],
    queryFn: async () => {
      return api.get<{ totalVehicles: number; available: number; inUse: number; activeCheckouts: number }>(
        "/stats/vehicles",
      );
    }
  });

  const { data: myVehicleCheckouts } = useQuery({
    queryKey: ["my-vehicle-checkouts", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      return api.get<any[]>("/vehicle-checkouts", { status: "checked_out", scope: "mine" });
    },
    enabled: !!profile?.id,
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles-list-dashboard"],
    queryFn: async () => {
      return api.get<any[]>("/vehicles");
    }
  });

  const brands = useMemo(() => {
    const u = [...new Set((vehicles || []).map((v: any) => v.brand).filter(Boolean))] as string[];
    return u.sort();
  }, [vehicles]);

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || brandFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setBrandFilter("all");
  };

  const filteredVehicles = (vehicles || []).filter((v: any) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    const matchesType = typeFilter === "all" || v.vehicle_type === typeFilter;
    const matchesBrand = brandFilter === "all" || v.brand === brandFilter;
    return matchesSearch && matchesStatus && matchesType && matchesBrand;
  });

  const myActiveVehicleIds = new Set(
    (myVehicleCheckouts || []).map((c: any) => c.vehicle_id)
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 pb-3 sm:pb-4">
        <ModuleHero
          eyebrow="Módulo · Veículos"
          title="Painel da Frota"
          subtitle="Busque, filtre e gerencie entradas e saídas de veículos"
          floating={
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Disponíveis</p>
                  <p className="text-xl sm:text-3xl font-bold text-success mt-1">{stats?.available || 0}</p>
                </div>
                <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
                  <p className="text-xl sm:text-3xl font-bold mt-1">{stats?.totalVehicles || 0}</p>
                </div>
                <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Em Uso</p>
                  <p className="text-xl sm:text-3xl font-bold text-warning mt-1">{stats?.inUse || 0}</p>
                </div>
              </div>

              {myVehicleCheckouts && myVehicleCheckouts.length > 0 && (
                <Card
                  className="border-primary/50 bg-primary/5 cursor-pointer"
                  onClick={() => setMyVehiclesExpanded(!myVehiclesExpanded)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm sm:text-base flex items-center justify-between text-primary">
                      <span className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        Meus Veículos em Uso ({myVehicleCheckouts.length})
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${myVehiclesExpanded ? "rotate-180" : ""}`} />
                    </CardTitle>
                  </CardHeader>
                  {myVehiclesExpanded && (
                    <CardContent className="space-y-2 max-h-[250px] overflow-y-auto pt-0" onClick={(e) => e.stopPropagation()}>
                      {myVehicleCheckouts.map((checkout: any) => (
                        <div key={checkout.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/80">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {checkout.vehicles?.name} - {checkout.vehicles?.plate}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>KM: {checkout.km_checkout}</span>
                              <span>Saída: {format(new Date(checkout.checkout_date), "dd/MM HH:mm", { locale: ptBR })}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" onClick={() => navigate(`/veiculos/chegada`)}>
                            Devolução <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          }
        />
      </div>


      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Lista de Veículos</CardTitle>
              <CardDescription>
                {filteredVehicles.length} de {vehicles?.length || 0} veículos
              </CardDescription>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm" variant="outline" className="text-xs gap-1"
                onClick={async () => {
                  const headers = ["Nome", "Placa", "Marca", "Modelo", "Cor", "Status"];
                  const rows = filteredVehicles.map((v: any) => [
                    v.name, v.plate, v.brand || "-", v.model || "-", v.color || "-",
                    v.status === "available" ? "Disponível" : "Em uso",
                  ]);
                  await exportToPDF({ title: "Relatório de Veículos", headers, rows, filename: "veiculos", generatedBy: profile?.full_name });
                  toast.success("PDF exportado!");
                }}
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button
                size="sm" variant="outline" className="text-xs gap-1"
                onClick={() => {
                  const headers = ["Nome", "Placa", "Marca", "Modelo", "Cor", "Status"];
                  const rows = filteredVehicles.map((v: any) => [
                    v.name, v.plate, v.brand || "-", v.model || "-", v.color || "-",
                    v.status === "available" ? "Disponível" : "Em uso",
                  ]);
                  exportToExcel({ title: "Relatório de Veículos", headers, rows, filename: "veiculos", generatedBy: profile?.full_name });
                  toast.success("Excel exportado!");
                }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col space-y-4">
          <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, placa, marca ou modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Buscar veículo"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"} size="icon"
              onClick={() => setShowFilters(!showFilters)} className="relative"
              aria-label="Mostrar filtros avançados" aria-pressed={showFilters}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-3 p-4 bg-muted/50 rounded-lg border animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="in_use">Em uso</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="vehicle">Veículo</SelectItem>
                    <SelectItem value="platform">Plataforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Marca</label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as marcas</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <div className="sm:col-span-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                    <X className="w-3 h-3" /> Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : filteredVehicles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum veículo encontrado
              </p>
            ) : (
              filteredVehicles.map((vehicle: any) => {
                const userHasVehicle = myActiveVehicleIds.has(vehicle.id);
                const isAvailable = vehicle.status === "available";
                return (
                  <Card key={vehicle.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/veiculos/${vehicle.id}`)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm sm:text-base">{vehicle.name}</h3>
                            <Badge variant="secondary" className="text-xs font-mono">{vehicle.plate}</Badge>
                            {vehicle.vehicle_type === "platform" && (
                              <Badge variant="outline" className="text-xs">Plataforma</Badge>
                            )}
                            <span className={`text-xs font-medium ${isAvailable ? "text-success" : "text-warning"}`}>
                              {isAvailable ? "Disponível" : "Em uso"}
                            </span>
                            {vehicle.is_charging && (
                              <Badge className="text-xs gap-1 bg-info/15 text-info border border-info/30 hover:bg-info/20">
                                <PlugZap className="w-3 h-3" />
                                Carregando
                                {vehicle.charging_started_at && (
                                  <span className="opacity-80">
                                    · há {formatDistanceToNowStrict(new Date(vehicle.charging_started_at), { locale: ptBR })}
                                  </span>
                                )}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
                            {vehicle.brand && <span>{vehicle.brand}</span>}
                            {vehicle.model && <span>• {vehicle.model}</span>}
                            {vehicle.color && <span>• {vehicle.color}</span>}
                            {vehicle.year && <span>• {vehicle.year}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {isAvailable && !vehicle.is_charging && (
                            <Button size="sm" className="text-xs gap-1" onClick={() => navigate(`/veiculos/saida?vehicleId=${vehicle.id}`)}>
                              Registrar Saída
                            </Button>
                          )}
                          {isAvailable && vehicle.vehicle_type === "platform" && (
                            <Button
                              size="sm"
                              variant={vehicle.is_charging ? "default" : "outline"}
                              className="text-xs gap-1"
                              disabled={togglingId === vehicle.id}
                              onClick={() => toggleCharging(vehicle.id, !vehicle.is_charging)}
                            >
                              {vehicle.is_charging ? (
                                <><Plug className="w-3.5 h-3.5" /> Finalizar carga</>
                              ) : (
                                <><PlugZap className="w-3.5 h-3.5" /> Carregando</>
                              )}
                            </Button>
                          )}
                          {userHasVehicle && (
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate("/veiculos/chegada")}>
                              Registrar Devolução
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
