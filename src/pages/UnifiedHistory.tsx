import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wrench, Car, Eye, List, FileText, FileSpreadsheet, Clock, MapPin, Camera } from "lucide-react";
import { format, subDays, subMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SignedImage } from "@/components/SignedImage";
import { AssetTimeline } from "@/components/admin/AssetTimeline";
import { HistorySkeleton } from "@/components/PageSkeleton";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";
import { ModuleHero } from "@/components/ModuleHero";

interface UnifiedEvent {
  id: string;
  type: "tool" | "vehicle";
  date: string;
  title: string;
  subtitle: string;
  status: string;
  endDate?: string | null;
  // Extra details for modal
  details?: {
    notes?: string | null;
    construction_site?: string | null;
    destination?: string | null;
    km_checkout?: number;
    km_checkin?: number | null;
    photo_checkout?: string | null;
    photo_checkin?: string | null;
    selected_tag?: string | null;
    client_name?: string | null;
    entry_type?: string | null;
    checked_out_by?: string | null;
    checked_in_by?: string | null;
  };
}

interface UnifiedHistoryProps {
  /** When true, omits the page title (use when embedded in another page). */
  embedded?: boolean;
  /** Default heading shown above the filters. */
  title?: string;
  description?: string;
}

export default function UnifiedHistory({
  embedded = false,
  title = "Meu Histórico",
  description = "Visão unificada de ferramentas e veículos — use os filtros para refinar",
}: UnifiedHistoryProps) {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("tipo") || "all";
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");

  useEffect(() => {
    if (profile?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, periodFilter]);

  const getStartDate = () => {
    const now = new Date();
    switch (periodFilter) {
      case "today": return startOfDay(now).toISOString();
      case "7d": return subDays(now, 7).toISOString();
      case "30d": return subDays(now, 30).toISOString();
      case "3m": return subMonths(now, 3).toISOString();
      default: return subDays(now, 7).toISOString();
    }
  };

  const loadAll = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const since = getStartDate();

    // Os nomes de quem registrou chegam em *_profile; mantém o formato antigo (checked_out_by.full_name).
    const withActors = (rows: any[]) =>
      rows.map((r) => ({ ...r, checked_out_by: r.checked_out_by_profile, checked_in_by: r.checked_in_by_profile }));
    const [toolsRes, vehiclesRes] = await Promise.all([
      api
        .get<any[]>("/tool-checkouts", { scope: "mine", from: since, limit: 200 })
        .then((data) => ({ data: withActors(data) }))
        .catch(() => ({ data: [] as any[] })),
      api
        .get<any[]>("/vehicle-checkouts", { scope: "mine", from: since, limit: 200 })
        .then((data) => ({ data: withActors(data) }))
        .catch(() => ({ data: [] as any[] })),
    ]);

    const unified: UnifiedEvent[] = [];

    (toolsRes.data || []).forEach((t: any) => {
      unified.push({
        id: `tool-${t.id}`,
        type: "tool",
        date: t.checkout_date,
        title: t.tools?.name || "Ferramenta",
        subtitle: t.construction_site || "Sem obra",
        status: t.status === "checked_out" ? "Em uso" : "Devolvido",
        endDate: t.checkin_date,
        details: {
          notes: t.notes,
          construction_site: t.construction_site,
          selected_tag: t.selected_tag || t.tools?.tag,
          photo_checkout: t.checkout_photo_url,
          photo_checkin: t.checkin_photo_url,
          checked_out_by: t.checked_out_by?.full_name,
          checked_in_by: t.checked_in_by?.full_name,
        }
      });
    });

    (vehiclesRes.data || []).forEach((v: any) => {
      unified.push({
        id: `vehicle-${v.id}`,
        type: "vehicle",
        date: v.checkout_date,
        title: `${v.vehicles?.name || "Veículo"} (${v.vehicles?.plate || ""})`,
        subtitle: v.destination || "Sem destino",
        status: v.status === "checked_out" ? "Em uso" : "Devolvido",
        endDate: v.checkin_date,
        details: {
          notes: v.notes,
          destination: v.destination,
          km_checkout: v.km_checkout,
          km_checkin: v.km_checkin,
          photo_checkout: v.photo_dashboard_checkout,
          photo_checkin: v.photo_dashboard_checkin,
          checked_out_by: v.checked_out_by?.full_name,
          checked_in_by: v.checked_in_by?.full_name,
        }
      });
    });





    unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(unified);
    setLoading(false);
  };

  const iconMap = {
    tool: <Wrench className="w-4 h-4" aria-hidden="true" />,
    vehicle: <Car className="w-4 h-4" aria-hidden="true" />,
  };

  const colorMap = {
    tool: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    vehicle: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  const filtered = typeFilter === "all" ? events : events.filter((e) => e.type === typeFilter);

  const grouped = filtered.reduce<Record<string, UnifiedEvent[]>>((acc, ev) => {
    const day = format(new Date(ev.date), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(ev);
    return acc;
  }, {});

  const typeLabel = (t: UnifiedEvent["type"]) =>
    t === "tool" ? "Ferramenta" : "Veículo";

  const buildExportRows = () =>
    filtered.map((ev) => [
      format(new Date(ev.date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      typeLabel(ev.type),
      ev.title,
      ev.subtitle,
      ev.status,
      ev.endDate ? format(new Date(ev.endDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      ev.details?.notes || "-",
    ]);

  const handleExportPDF = async () => {
    if (filtered.length === 0) return toast.error("Nenhum registro para exportar");
    try {
      await exportToPDF({
        title: "Meu Histórico Unificado",
        subtitle: `${filtered.length} registro(s)`,
        headers: ["Data/Hora", "Tipo", "Item", "Detalhe", "Status", "Fim", "Observações"],
        rows: buildExportRows(),
        filename: "meu-historico",
        orientation: "landscape",
        generatedBy: profile?.full_name,
      });
      toast.success("PDF gerado");
    } catch (e) { console.error(e); toast.error("Erro ao gerar PDF"); }
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) return toast.error("Nenhum registro para exportar");
    try {
      exportToExcel({
        title: "Meu Histórico Unificado",
        subtitle: `${filtered.length} registro(s)`,
        headers: ["Data/Hora", "Tipo", "Item", "Detalhe", "Status", "Fim", "Observações"],
        rows: buildExportRows(),
        filename: "meu-historico",
        generatedBy: profile?.full_name,
      });
      toast.success("Planilha gerada");
    } catch (e) { console.error(e); toast.error("Erro ao gerar planilha"); }
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  return (
    <div className={`animate-fade-in ${!embedded ? "flex flex-col h-full min-h-0" : ""}`}>
      {!embedded && (
        <div className="shrink-0">
          <ModuleHero eyebrow="Módulo · Histórico" title={title || "Meu Histórico"} subtitle={description} />
        </div>
      )}
      <div className={`space-y-4 max-w-3xl mx-auto w-full ${!embedded ? "px-3 sm:px-6 pt-4 relative z-10 flex-1 min-h-0 flex flex-col" : ""}`}>



      <div className="flex gap-1.5 items-center justify-between flex-wrap shrink-0" role="group" aria-label="Filtros do histórico">
        <div className="flex gap-1.5 flex-wrap items-center">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Filtrar por período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="3m">3 meses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filtrar por módulo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              <SelectItem value="tool">Ferramentas</SelectItem>
              <SelectItem value="vehicle">Veículos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1.5 items-center flex-wrap">
          <div className="flex gap-0.5 bg-muted/50 p-0.5 rounded-md border">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("list")}
              title="Visualização em lista"
            >
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("timeline")}
              title="Visualização em timeline"
            >
              <Clock className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filtered.length === 0} className="gap-1 h-8 px-2 text-xs">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filtered.length === 0} className="gap-1 h-8 px-2 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>



      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
      {Object.keys(grouped).length === 0 ? (

        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma atividade no período selecionado
          </CardContent>
        </Card>
      ) : viewMode === "timeline" ? (
        <Card className="p-4">
          <AssetTimeline
            events={filtered.map((ev) => ({
              id: ev.id,
              date: ev.endDate || ev.date,
              action: ev.status,
              description: ev.title + (ev.subtitle ? ` — ${ev.subtitle}` : ""),
              user: ev.details?.checked_out_by || profile?.full_name || "Usuário",
              type: ev.type === "tool" ? (ev.status === "Em uso" ? "checkout" : "checkin") : 
                    ev.type === "vehicle" ? (ev.status === "Em uso" ? "checkout" : "checkin") : "checkout"
            }))}
          />
        </Card>
      ) : (
        Object.entries(grouped).map(([day, dayEvents]) => (
          <div key={day} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1 z-10">
              {format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h3>
            {dayEvents.map((ev) => (
              <Dialog key={ev.id}>
                <DialogTrigger asChild>
                  <Card 
                    className="p-3 transition-all hover:shadow-soft hover:border-primary/50 cursor-pointer group"
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${colorMap[ev.type]}`}>
                        {iconMap[ev.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{ev.title}</p>
                          {ev.details?.selected_tag && (
                            <Badge variant="outline" className="text-[10px] font-mono h-4 py-0">
                              {ev.details.selected_tag}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(ev.date), "HH:mm")}</span>
                          {ev.endDate && <span>→ {format(new Date(ev.endDate), "HH:mm")}</span>}
                          <span>• {ev.subtitle}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            ev.status === "Em uso" || ev.status === "Aberto" || ev.status === "Pendente"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs shrink-0"
                        >
                          {ev.status}
                        </Badge>
                        <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-full ${colorMap[ev.type]}`}>
                        {iconMap[ev.type]}
                      </div>
                      Detalhes da Atividade
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Item / Atividade</p>
                        <p className="font-semibold text-lg">{ev.title}</p>
                        {ev.details?.selected_tag && (
                          <p className="text-xs font-mono text-primary bg-primary/5 inline-block px-1 rounded mt-1">
                            TAG: {ev.details.selected_tag}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                        <Badge
                          variant={
                            ev.status === "Em uso" || ev.status === "Aberto" || ev.status === "Pendente"
                              ? "default"
                              : "secondary"
                          }
                          className="mt-1"
                        >
                          {ev.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Retirada
                        </p>
                        <p className="text-sm font-medium">
                          {format(new Date(ev.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {ev.details?.checked_out_by && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Por: {ev.details.checked_out_by}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Devolução
                        </p>
                        <p className="text-sm font-medium">
                          {ev.endDate 
                            ? format(new Date(ev.endDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "Ainda em uso"}
                        </p>
                        {ev.details?.checked_in_by && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Por: {ev.details.checked_in_by}</p>
                        )}
                      </div>
                    </div>

                    {(ev.details?.construction_site || ev.details?.destination || ev.details?.client_name) && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <MapPin className="w-3 h-3" />
                          <p className="text-xs font-medium uppercase tracking-wider">Localização / Destino</p>
                        </div>
                        <p className="text-sm">
                          {ev.details.construction_site || ev.details.destination || ev.details.client_name}
                          {ev.details.entry_type && <span className="text-xs text-muted-foreground ml-2 italic">({ev.details.entry_type})</span>}
                        </p>
                      </div>
                    )}

                    {ev.type === "vehicle" && ev.details?.km_checkout !== undefined && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">KM Saída</p>
                          <p className="text-sm font-bold">{ev.details.km_checkout.toLocaleString()} km</p>
                        </div>
                        {ev.details.km_checkin !== null && (
                          <>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">KM Chegada</p>
                              <p className="text-sm font-bold">{ev.details.km_checkin.toLocaleString()} km</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground font-bold text-primary">Total Percorrido</p>
                              <p className="text-sm font-bold text-primary">
                                {(ev.details.km_checkin - ev.details.km_checkout).toLocaleString()} km
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(ev.details?.photo_checkout || ev.details?.photo_checkin) && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Camera className="w-3 h-3" />
                          <p className="text-xs font-medium uppercase tracking-wider">Evidências Fotográficas</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {ev.details.photo_checkout && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground text-center">Início / Saída</p>
                              <SignedImage storagePath={ev.details.photo_checkout} alt="Foto de saída" className="w-full h-32 object-cover rounded-md border" />
                            </div>
                          )}
                          {ev.details.photo_checkin && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground text-center">Fim / Devolução</p>
                              <SignedImage storagePath={ev.details.photo_checkin} alt="Foto de chegada" className="w-full h-32 object-cover rounded-md border" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {ev.details?.notes && (
                      <div className="pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                        <div className="bg-muted/50 p-3 rounded-md italic text-sm text-muted-foreground">
                          "{ev.details.notes}"
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        ))
      )}
        </CardContent>
      </Card>
      </div>
    </div>

  );
}
