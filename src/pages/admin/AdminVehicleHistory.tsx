import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays, subMonths, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Loader2, Search, Eye, FileText, FileSpreadsheet, Camera, Brain, Trash2, X, List, Clock, PlugZap, ChevronDown, ChevronRight, SlidersHorizontal, ChevronLeft, ChevronsLeft, ChevronsRight, AlertTriangle, Wrench } from "lucide-react";
import { Label } from "@/components/ui/label";
import { HistorySkeleton } from "@/components/PageSkeleton";
import { AssetTimeline } from "@/components/admin/AssetTimeline";
import { SignedImage } from "@/components/SignedImage";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { DeleteWithReasonDialog } from "@/components/DeleteWithReasonDialog";

type VehicleHistoryCategory = "engemase_employee" | "third_party" | "socios" | null;

// Formata duração entre saída e devolução como "Xh Ymin" (relatório de horas de uso — útil p/ plataformas sem hodômetro)
function formatUsageHours(checkout: string, checkin: string | null): string {
  if (!checkin) return "-";
  const ms = new Date(checkin).getTime() - new Date(checkout).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
function usageHoursDecimal(checkout: string, checkin: string | null): number | null {
  if (!checkin) return null;
  const ms = new Date(checkin).getTime() - new Date(checkout).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Number((ms / 3600000).toFixed(2));
}

interface VehicleHistoryEntry {
  id: string;
  checkout_date: string;
  checkin_date: string | null;
  status: string | null;
  destination: string | null;
  km_checkout: number;
  km_checkin: number | null;
  km_checkin_automatic: boolean | null;
  refueled: boolean | null;
  notes: string | null;
  photo_front_checkout: string | null;
  photo_back_checkout: string | null;
  photo_left_checkout: string | null;
  photo_right_checkout: string | null;
  photo_dashboard_checkout: string | null;
  photo_front_checkin: string | null;
  photo_back_checkin: string | null;
  photo_left_checkin: string | null;
  photo_right_checkin: string | null;
  photo_dashboard_checkin: string | null;
  vehicles: {
    name: string;
    plate: string;
  } | null;
  profiles: {
    full_name: string;
    category: VehicleHistoryCategory;
  } | null;
  checked_out_by_profile: {
    full_name: string;
  } | null;
  checked_in_by_profile: {
    full_name: string;
  } | null;
}

export default function AdminVehicleHistory() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: history = [], isLoading: loading } = useQuery<VehicleHistoryEntry[]>({
    queryKey: ["admin-vehicle-history"],
    queryFn: async () => {
      // Retorna todas as colunas (inclui fotos de interior, rodas e controle, que a função antiga omitia).
      const data = await api.get<any[]>("/vehicle-checkouts", { limit: 10000 });
      return data.map((entry) => ({
        ...entry,
        vehicles: entry.vehicles ? { name: entry.vehicles.name || "Veículo", plate: entry.vehicles.plate || "-" } : null,
        profiles: {
          full_name: entry.profiles?.full_name || "Usuário não encontrado",
          category: entry.profiles?.category as VehicleHistoryCategory,
        },
      })) as VehicleHistoryEntry[];
    },
    staleTime: 30_000,
  });

  // Sessões de carregamento (só plataformas têm)
  const { data: chargingSessions = [] } = useQuery({
    queryKey: ["admin-vehicle-charging-sessions"],
    queryFn: async () => {
      const [sessRes, vehRes, usersRes] = await Promise.all([
        api.get<any[]>("/vehicles/charging-sessions").then((data) => ({ data })),
        api.get<any[]>("/vehicles").then((data) => ({ data })),
        api.get<any[]>("/users/approved").then((data) => ({ data })),
      ]);
      const vMap = new Map<string, { name: string; plate: string; type: string | null }>();
      ((vehRes.data as any[]) || []).forEach((v) =>
        vMap.set(v.id, { name: v.name, plate: v.plate, type: v.vehicle_type })
      );
      const uMap = new Map<string, string>();
      ((usersRes.data as any[]) || []).forEach((u) => uMap.set(u.id, u.full_name));
      return ((sessRes.data as any[]) || []).map((s) => {
        const v = vMap.get(s.vehicle_id);
        const durationMs = s.ended_at
          ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
          : Date.now() - new Date(s.started_at).getTime();
        return {
          id: s.id as string,
          vehicle_id: s.vehicle_id as string,
          vehicle_name: v?.name || "—",
          vehicle_plate: v?.plate || "—",
          started_at: s.started_at as string,
          ended_at: s.ended_at as string | null,
          started_by_name: uMap.get(s.started_by) || "—",
          ended_by_name: s.ended_by ? uMap.get(s.ended_by) || "—" : null,
          duration_hours: Number((Math.max(0, durationMs) / 3600000).toFixed(2)),
        };
      });
    },
    staleTime: 30_000,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<VehicleHistoryEntry | null>(null);
  const [aiEstimation, setAiEstimation] = useState<{
    checkout_km: number | null;
    checkin_km: number | null;
    distance_km: number | null;
    confidence: string;
    notes: string;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; entry: VehicleHistoryEntry | null }>({ open: false, entry: null });
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inconsistentOpen, setInconsistentOpen] = useState(false);
  const [kmFixDialog, setKmFixDialog] = useState<{ open: boolean; entry: VehicleHistoryEntry | null }>({ open: false, entry: null });
  const [kmFixCheckout, setKmFixCheckout] = useState<string>("");
  const [kmFixCheckin, setKmFixCheckin] = useState<string>("");
  const [kmFixSaving, setKmFixSaving] = useState(false);

  const inconsistentEntries = useMemo(
    () => history.filter((e) => e.km_checkin !== null && e.km_checkin <= e.km_checkout),
    [history]
  );

  const openKmFix = (entry: VehicleHistoryEntry) => {
    setKmFixCheckout(String(entry.km_checkout ?? ""));
    setKmFixCheckin(entry.km_checkin !== null ? String(entry.km_checkin) : "");
    setKmFixDialog({ open: true, entry });
  };

  const handleKmFix = async () => {
    if (!kmFixDialog.entry) return;
    const outNum = Number(kmFixCheckout);
    const inNum = Number(kmFixCheckin);
    if (!Number.isFinite(outNum) || !Number.isFinite(inNum) || outNum < 0 || inNum < 0) {
      toast.error("Informe quilometragens válidas (números não negativos).");
      return;
    }
    if (inNum < outNum) {
      toast.error("KM de devolução não pode ser menor que a KM de saída.");
      return;
    }
    setKmFixSaving(true);
    try {
      const entry = kmFixDialog.entry;
      // O servidor valida e registra a correção na auditoria.
      await api.patch(`/vehicle-checkouts/${entry.id}`, {
        km_checkout: outNum,
        km_checkin: inNum,
        km_checkin_automatic: false,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-vehicle-history"] });
      toast.success("Quilometragem corrigida com sucesso.");
      setKmFixDialog({ open: false, entry: null });
    } catch (err) {
      console.error("Erro ao corrigir KM:", err);
      toast.error("Erro ao corrigir quilometragem");
    } finally {
      setKmFixSaving(false);
    }
  };

  const handleDeleteEntry = async (reason: string) => {
    if (!deleteDialog.entry) return;
    try {
      await api.delete(`/vehicle-checkouts/${deleteDialog.entry.id}`, { reason });

      queryClient.invalidateQueries({ queryKey: ["admin-vehicle-history"] });
      toast.success("Registro excluído com sucesso");
    } catch (error) {
      console.error("Erro ao excluir registro:", error);
      toast.error("Erro ao excluir registro");
      throw error;
    }
  };

  const isAdmin = profile?.role === "admin";


  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case "7d": return { start: subDays(now, 7), end: now };
      case "30d": return { start: subDays(now, 30), end: now };
      case "90d": return { start: subDays(now, 90), end: now };
      case "6m": return { start: subMonths(now, 6), end: now };
      case "1y": return { start: subMonths(now, 12), end: now };
      default: return null;
    }
  };

  const filteredHistory = history.filter((entry) => {
    const matchesSearch =
      entry.vehicles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.vehicles?.plate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.destination && entry.destination.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || entry.status === statusFilter;

    const matchesCategory =
      categoryFilter === "all" || entry.profiles?.category === categoryFilter;

    const dateRange = getDateRange();
    const matchesPeriod = !dateRange || (
      isAfter(new Date(entry.checkout_date), startOfDay(dateRange.start)) &&
      isBefore(new Date(entry.checkout_date), endOfDay(dateRange.end))
    );

    return matchesSearch && matchesStatus && matchesCategory && matchesPeriod;
  });

  // Filtragem das sessões de carregamento (usa mesma busca + período)
  const filteredCharging = chargingSessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      s.vehicle_name.toLowerCase().includes(q) ||
      s.vehicle_plate.toLowerCase().includes(q) ||
      s.started_by_name.toLowerCase().includes(q) ||
      (s.ended_by_name?.toLowerCase().includes(q) ?? false);
    const dateRange = getDateRange();
    const matchesPeriod =
      !dateRange ||
      (isAfter(new Date(s.started_at), startOfDay(dateRange.start)) &&
        isBefore(new Date(s.started_at), endOfDay(dateRange.end)));
    return matchesSearch && matchesPeriod;
  });

  // Horímetro consolidado por plataforma
  const platformHourMeter = Object.values(
    filteredCharging.reduce<Record<string, { vehicle: string; plate: string; sessions: number; hours: number }>>(
      (acc, s) => {
        const key = s.vehicle_id;
        if (!acc[key]) acc[key] = { vehicle: s.vehicle_name, plate: s.vehicle_plate, sessions: 0, hours: 0 };
        acc[key].sessions += 1;
        acc[key].hours += s.duration_hours;
        return acc;
      },
      {}
    )
  ).sort((a, b) => b.hours - a.hours);

  const exportChargingPDF = async () => {
    if (filteredCharging.length === 0) {
      toast.error("Nenhuma sessão de carregamento para exportar");
      return;
    }
    const headers = ["Plataforma", "Placa", "Colocou p/ carregar", "Início", "Retirou da carga", "Fim", "Duração", "Horas"];
    const rows = filteredCharging.map((s) => [
      s.vehicle_name,
      s.vehicle_plate,
      s.started_by_name,
      format(new Date(s.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      s.ended_by_name || "—",
      s.ended_at ? format(new Date(s.ended_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Em andamento",
      s.duration_hours >= 1 ? `${Math.floor(s.duration_hours)}h ${Math.round((s.duration_hours % 1) * 60)}min` : `${Math.round(s.duration_hours * 60)}min`,
      s.duration_hours.toFixed(2),
    ]);
    await exportToPDF({
      title: "Carregamentos de Plataforma",
      subtitle: `Total: ${filteredCharging.length} sessão(ões) · Horímetro acumulado: ${platformHourMeter.reduce((a, b) => a + b.hours, 0).toFixed(2)}h`,
      headers, rows,
      filename: `carregamentos-plataforma-${format(new Date(), "yyyy-MM-dd")}`,
      orientation: "landscape",
    });
    toast.success("PDF exportado!");
  };

  const exportChargingExcel = () => {
    if (filteredCharging.length === 0) {
      toast.error("Nenhuma sessão de carregamento para exportar");
      return;
    }
    const headers = ["Plataforma", "Placa", "Colocou p/ carregar", "Início", "Retirou da carga", "Fim", "Horas (decimal)", "Status"];
    const rows = filteredCharging.map((s) => [
      s.vehicle_name,
      s.vehicle_plate,
      s.started_by_name,
      format(new Date(s.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      s.ended_by_name || "—",
      s.ended_at ? format(new Date(s.ended_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      s.duration_hours,
      s.ended_at ? "Finalizada" : "Em andamento",
    ]);
    exportToExcel({
      title: "Carregamentos de Plataforma",
      subtitle: `Total: ${filteredCharging.length} sessões`,
      headers, rows,
      filename: `carregamentos-plataforma-${format(new Date(), "yyyy-MM-dd")}`,
    });
    toast.success("Excel exportado!");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || categoryFilter !== "all" || periodFilter !== "all";

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, categoryFilter, periodFilter, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedHistory = useMemo(
    () => filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredHistory, currentPage, pageSize]
  );
  const firstIdx = filteredHistory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastIdx = Math.min(currentPage * pageSize, filteredHistory.length);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setPeriodFilter("all");
  };

  const getCategoryLabel = (category: VehicleHistoryCategory | undefined) => {
    if (category === "engemase_employee") return "Funcionário";
    if (category === "socios") return "Sócio";
    if (category === "third_party") return "Terceirizado";
    return "-";
  };

  const getCategoryBadge = (category: VehicleHistoryCategory | undefined) => {
    if (category === "engemase_employee") {
      return <Badge className="bg-badge-employee text-badge-employee-foreground">Funcionário</Badge>;
    }
    if (category === "socios") {
      return <Badge className="bg-primary text-primary-foreground">Sócio</Badge>;
    }
    if (!category) {
      return <span className="text-muted-foreground">-</span>;
    }
    return <Badge className="bg-badge-thirdparty text-badge-thirdparty-foreground">Terceirizado</Badge>;
  };

  const hasPhotos = (entry: VehicleHistoryEntry) => {
    return entry.photo_front_checkout || entry.photo_front_checkin ||
      entry.photo_dashboard_checkout || entry.photo_dashboard_checkin;
  };

  const canEstimateKm = (entry: VehicleHistoryEntry) => {
    return entry.photo_dashboard_checkout && entry.photo_dashboard_checkin;
  };

  const estimateKm = async (entry: VehicleHistoryEntry) => {
    if (!entry.photo_dashboard_checkout || !entry.photo_dashboard_checkin) {
      toast.error("Fotos do painel de saída e devolução são necessárias");
      return;
    }

    setEstimating(true);
    setAiEstimation(null);

    try {
      const data = await api.post("/vehicle-checkouts/read-odometer", {
        checkout_photo_path: entry.photo_dashboard_checkout,
        checkin_photo_path: entry.photo_dashboard_checkin,
      });

      const estimation = data as {
        checkout_km: number | null;
        checkin_km: number | null;
        distance_km: number | null;
        confidence: string;
        notes: string;
      };

      setAiEstimation(estimation);

      if (estimation.confidence === "low" || estimation.checkin_km === null) {
        toast.warning("Baixa confiança na leitura. Verifique manualmente.");
        return;
      }

      const updateData: { km_checkin: number; km_checkout?: number } = {
        km_checkin: estimation.checkin_km,
      };

      if (estimation.checkout_km !== null && entry.km_checkout === 0) {
        updateData.km_checkout = estimation.checkout_km;
      }

      await api.patch(`/vehicle-checkouts/${entry.id}`, { ...updateData, km_checkin_automatic: true });

      queryClient.invalidateQueries({ queryKey: ["admin-vehicle-history"] });

      setSelectedEntry((prev) =>
        prev && prev.id === entry.id
          ? {
              ...prev,
              km_checkin: estimation.checkin_km,
              km_checkout: updateData.km_checkout ?? prev.km_checkout,
            }
          : prev
      );

      toast.success("Estimativa concluída e salva no histórico!");
    } catch (error) {
      console.error("Error estimating km:", error);
      toast.error("Erro ao estimar quilometragem");
    } finally {
      setEstimating(false);
    }
  };

  const exportPDF = async () => {
    if (filteredHistory.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    const headers = ["Veículo", "Placa", "Usuário", "Categoria", "Destino", "Saída", "KM Saída", "Chegada", "KM Chegada", "Tempo de Uso", "Status"];
    const rows = filteredHistory.map((e) => [
      e.vehicles?.name,
      e.vehicles?.plate,
      e.profiles?.full_name || "Usuário não encontrado",
      getCategoryLabel(e.profiles?.category),
      e.destination || "-",
      format(new Date(e.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      e.km_checkout.toLocaleString(),
      e.checkin_date ? format(new Date(e.checkin_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      e.km_checkin !== null ? e.km_checkin.toLocaleString() : "-",
      formatUsageHours(e.checkout_date, e.checkin_date),
      e.status === "checked_out" ? "Em Uso" : "Devolvido",
    ]);
    await exportToPDF({
      title: "Histórico de Veículos",
      subtitle: `Total: ${filteredHistory.length} registros`,
      headers, rows,
      filename: `historico-veiculos-${format(new Date(), "yyyy-MM-dd")}`,
      orientation: "landscape",
    });
    toast.success("PDF exportado!");
  };

  const exportExcel = () => {
    if (filteredHistory.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    const headers = ["Veículo", "Placa", "Usuário", "Categoria", "Destino", "Saída", "KM Saída", "Chegada", "KM Chegada", "KM Percorridos", "Tempo de Uso", "Horas (decimal)", "Abastecido", "Status", "Retirado por", "Devolvido por", "Observações"];
    const rows = filteredHistory.map((e) => [
      e.vehicles?.name,
      e.vehicles?.plate,
      e.profiles?.full_name || "Usuário não encontrado",
      getCategoryLabel(e.profiles?.category),
      e.destination || "-",
      format(new Date(e.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      e.km_checkout,
      e.checkin_date ? format(new Date(e.checkin_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      e.km_checkin !== null ? e.km_checkin : "-",
      e.km_checkin !== null ? e.km_checkin - e.km_checkout : "-",
      formatUsageHours(e.checkout_date, e.checkin_date),
      usageHoursDecimal(e.checkout_date, e.checkin_date) ?? "-",
      e.refueled === null ? "-" : e.refueled ? "Sim" : "Não",
      e.status === "checked_out" ? "Em Uso" : "Devolvido",
      e.checked_out_by_profile?.full_name || "-",
      e.checked_in_by_profile?.full_name || "-",
      e.notes || "-",
    ]);
    exportToExcel({
      title: "Histórico de Veículos",
      subtitle: `Total: ${filteredHistory.length} registros`,
      headers, rows,
      filename: `historico-veiculos-${format(new Date(), "yyyy-MM-dd")}`,
    });
    toast.success("Excel exportado!");
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  const PhotoSection = ({ label, photos }: { label: string; photos: { label: string; path: string | null }[] }) => {
    const validPhotos = photos.filter(p => p.path);
    if (validPhotos.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {validPhotos.map((photo, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground mb-1">{photo.label}</p>
              <SignedImage storagePath={photo.path!} alt={photo.label} className="w-full h-24 object-cover rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (periodFilter !== "all" ? 1 : 0);

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (!profile) {
    return <Navigate to="/" />;
  }
  return (
    <div className="flex flex-col h-full min-h-0 gap-3 sm:gap-4">
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="shrink-0 flex items-center justify-between flex-wrap gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                <X className="w-3 h-3" />
                Limpar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
          </div>
        </div>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <Card className="shrink-0 mt-2">
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar veículo, placa ou usuário..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="checked_out">Em Uso</SelectItem>
                    <SelectItem value="checked_in">Devolvido</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Categorias</SelectItem>
                    <SelectItem value="engemase_employee">Funcionários</SelectItem>
                    <SelectItem value="third_party">Terceirizados</SelectItem>
                    <SelectItem value="socios">Sócios</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="6m">Últimos 6 meses</SelectItem>
                    <SelectItem value="1y">Último ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {isAdmin && inconsistentEntries.length > 0 && (
        <Collapsible open={inconsistentOpen} onOpenChange={setInconsistentOpen}>
          <Card className="shrink-0 border-amber-500/40 bg-amber-500/5">
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full text-left">
                <CardHeader className="p-3 sm:p-4 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <div>
                      <CardTitle className="text-sm md:text-base">Registros com quilometragem inconsistente</CardTitle>
                      <CardDescription className="text-xs">
                        {inconsistentEntries.length} registro(s) com KM de devolução menor ou igual à KM de saída. Corrija manualmente para reaparecerem nos totais.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{inconsistentEntries.length}</Badge>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", inconsistentOpen && "rotate-180")} />
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
                {inconsistentEntries.map((entry) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-border/60 bg-background p-2 sm:p-3">
                    <div className="text-xs sm:text-sm">
                      <div className="font-medium">
                        {entry.vehicles?.name || "Veículo"} ({entry.vehicles?.plate || "-"})
                      </div>
                      <div className="text-muted-foreground">
                        {entry.profiles?.full_name || "Usuário"} · {format(new Date(entry.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                      <div className="text-muted-foreground">
                        KM saída: <span className="font-medium text-foreground">{entry.km_checkout.toLocaleString()}</span>
                        {" · "}
                        KM devolução: <span className="font-medium text-foreground">{entry.km_checkin?.toLocaleString()}</span>
                        {" · "}
                        Diferença: <span className="font-medium text-destructive">{((entry.km_checkin ?? 0) - entry.km_checkout).toLocaleString()} km</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => openKmFix(entry)}>
                      <Wrench className="w-3.5 h-3.5" />
                      Corrigir
                    </Button>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Dialog open={kmFixDialog.open} onOpenChange={(open) => !open && setKmFixDialog({ open: false, entry: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir Quilometragem</DialogTitle>
          </DialogHeader>
          {kmFixDialog.entry && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {kmFixDialog.entry.vehicles?.name} ({kmFixDialog.entry.vehicles?.plate}) — {kmFixDialog.entry.profiles?.full_name}
              </div>
              <div className="space-y-2">
                <Label htmlFor="km-fix-out">KM de saída</Label>
                <Input
                  id="km-fix-out"
                  type="number"
                  min={0}
                  value={kmFixCheckout}
                  onChange={(e) => setKmFixCheckout(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="km-fix-in">KM de devolução</Label>
                <Input
                  id="km-fix-in"
                  type="number"
                  min={0}
                  value={kmFixCheckin}
                  onChange={(e) => setKmFixCheckin(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Deve ser maior que a KM de saída.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setKmFixDialog({ open: false, entry: null })} disabled={kmFixSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleKmFix} disabled={kmFixSaving}>
                  {kmFixSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar correção
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico de Movimentações</CardTitle>
            <CardDescription>
              {viewMode === "table" && filteredHistory.length > 0
                ? `Mostrando ${firstIdx}–${lastIdx} de ${filteredHistory.length} registros (de ${history.length} totais)`
                : `Mostrando ${filteredHistory.length} de ${history.length} registros`}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("table")}
              title="Visualização em tabela"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("timeline")}
              title="Visualização em timeline"
            >
              <Clock className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma movimentação encontrada
            </p>
          ) : viewMode === "timeline" ? (
            <AssetTimeline
              events={filteredHistory.map((entry) => ({
                id: entry.id,
                date: entry.status === "checked_in" && entry.checkin_date ? entry.checkin_date : entry.checkout_date,
                action: entry.status === "checked_out" ? "Retirada" : "Devolução",
                description: `${entry.vehicles?.name} (${entry.vehicles?.plate})${entry.destination ? ` — ${entry.destination}` : ""}${entry.km_checkin !== null ? ` • ${(entry.km_checkin - entry.km_checkout).toLocaleString()} km` : ""}`,
                user: entry.profiles?.full_name,
                type: entry.status === "checked_out" ? "checkout" : "checkin",
              }))}
            />
          ) : (
            <>
              {/* Desktop Table — densa, com zebra, header sticky e expansão inline */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="[&_th]:h-9 [&_th]:py-2">
                      <TableHead className="w-8" />
                      <TableHead className="min-w-[160px]">Veículo</TableHead>
                      <TableHead className="w-[100px]">Placa</TableHead>
                      <TableHead className="min-w-[160px]">Usuário</TableHead>
                      <TableHead className="w-[110px]">Categoria</TableHead>
                      <TableHead className="min-w-[140px]">Destino</TableHead>
                      <TableHead className="w-[120px]">Saída</TableHead>
                      <TableHead className="w-[120px]">Chegada</TableHead>
                      <TableHead className="w-[90px]">KM</TableHead>
                      <TableHead className="w-[90px]">Tempo</TableHead>
                      <TableHead className="w-[110px]">Status</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr[data-row='main']:nth-child(4n+1)]:bg-muted/30 [&_tr[data-row='main']:hover]:bg-accent/40 [&_tr[data-row='main']]:transition-colors [&_td]:py-2">
                    {paginatedHistory.map((entry) => {
                      const isExpanded = expandedId === entry.id;
                      return (
                        <Fragment key={entry.id}>
                          <TableRow
                            data-row="main"
                            className="cursor-pointer"
                            onClick={() => { setExpandedId(isExpanded ? null : entry.id); if (!isExpanded) setAiEstimation(null); }}
                          >
                            <TableCell className="w-8 pr-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium truncate max-w-[220px]" title={entry.vehicles?.name}>{entry.vehicles?.name}</TableCell>
                            <TableCell className="font-mono text-xs">{entry.vehicles?.plate}</TableCell>
                            <TableCell className="truncate max-w-[200px]" title={entry.profiles?.full_name}>{entry.profiles?.full_name}</TableCell>
                            <TableCell>{getCategoryBadge(entry.profiles?.category)}</TableCell>
                            <TableCell className="truncate max-w-[200px]" title={entry.destination || ""}>{entry.destination || "-"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {format(new Date(entry.checkout_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {entry.checkin_date
                                ? format(new Date(entry.checkin_date), "dd/MM/yy HH:mm", { locale: ptBR })
                                : "-"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              <div className="flex flex-col leading-tight">
                                <span>
                                  {entry.km_checkin !== null
                                    ? `${(entry.km_checkin - entry.km_checkout).toLocaleString()} km`
                                    : "-"}
                                </span>
                                {entry.checkin_date && entry.km_checkin_automatic === false && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 w-fit mt-0.5 border-orange-200 bg-orange-50 text-orange-700">Manual</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{formatUsageHours(entry.checkout_date, entry.checkin_date)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={entry.status === "checked_out" ? "default" : "secondary"} className="text-[10px] py-0 h-5">
                                  {entry.status === "checked_out" ? "Em Uso" : "Devolvido"}
                                </Badge>
                                {hasPhotos(entry) && <Camera className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { setExpandedId(isExpanded ? null : entry.id); if (!isExpanded) setAiEstimation(null); }}
                                  title={isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteDialog({ open: true, entry })}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow data-row="details" className="bg-muted/50 hover:bg-muted/50">
                              <TableCell colSpan={12} className="p-4">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Veículo</p>
                                      <p className="font-semibold text-sm">{entry.vehicles?.name} — {entry.vehicles?.plate}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Usuário</p>
                                      <p className="text-sm">{entry.profiles?.full_name}</p>
                                      <div className="mt-0.5">{getCategoryBadge(entry.profiles?.category)}</div>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Destino</p>
                                      <p className="text-sm">{entry.destination || "Não informado"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                                      <Badge variant={entry.status === "checked_out" ? "default" : "secondary"}>
                                        {entry.status === "checked_out" ? "Em Uso" : "Devolvido"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Saída</p>
                                      <p className="text-sm">{format(new Date(entry.checkout_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                      <p className="text-xs text-muted-foreground">
                                        KM: {entry.km_checkout.toLocaleString()} · Por: {entry.checked_out_by_profile?.full_name || "-"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Chegada</p>
                                      <p className="text-sm">
                                        {entry.checkin_date
                                          ? format(new Date(entry.checkin_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                          : "Não devolvido"}
                                      </p>
                                      {entry.km_checkin !== null && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                                          KM: {entry.km_checkin.toLocaleString()} · Por: {entry.checked_in_by_profile?.full_name || "-"}
                                          {entry.km_checkin_automatic === false && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-200 bg-orange-50 text-orange-700">Manual</Badge>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {entry.km_checkin !== null && (
                                    <div className="pt-3 border-t">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Distância Percorrida</p>
                                      <p className="text-lg font-bold text-primary">
                                        {(entry.km_checkin - entry.km_checkout).toLocaleString()} km
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Abastecido: {entry.refueled === null ? "Não informado" : entry.refueled ? "Sim" : "Não"}
                                      </p>
                                    </div>
                                  )}

                                  {canEstimateKm(entry) && (
                                    <div className="pt-3 border-t">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Estimativa por IA</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-2"
                                          onClick={() => { setSelectedEntry(entry); estimateKm(entry); }}
                                          disabled={estimating}
                                        >
                                          {estimating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                          {estimating ? "Analisando..." : "Estimar KM via IA"}
                                        </Button>
                                      </div>
                                      {aiEstimation && selectedEntry?.id === entry.id && (
                                        <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Badge variant={
                                              aiEstimation.confidence === "high" ? "default" :
                                              aiEstimation.confidence === "medium" ? "secondary" : "destructive"
                                            }>
                                              {aiEstimation.confidence === "high" ? "Alta confiança" :
                                               aiEstimation.confidence === "medium" ? "Média confiança" : "Baixa confiança"}
                                            </Badge>
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                              <p className="text-muted-foreground text-xs">KM Saída</p>
                                              <p className="font-medium">{aiEstimation.checkout_km?.toLocaleString() || "N/A"}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">KM Chegada</p>
                                              <p className="font-medium">{aiEstimation.checkin_km?.toLocaleString() || "N/A"}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">Distância</p>
                                              <p className="font-bold text-primary">{aiEstimation.distance_km?.toLocaleString() || "N/A"} km</p>
                                            </div>
                                          </div>
                                          {aiEstimation.notes && (
                                            <p className="text-xs text-muted-foreground">{aiEstimation.notes}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {entry.notes && (
                                    <div className="pt-3 border-t">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
                                      <p className="text-sm mt-1 whitespace-pre-wrap">{entry.notes}</p>
                                    </div>
                                  )}

                                  {hasPhotos(entry) && (
                                    <div className="pt-3 border-t space-y-3">
                                      <h4 className="font-semibold text-sm">Fotos — Comparativo Saída vs Devolução</h4>
                                      {[
                                        { label: "Frente", checkout: entry.photo_front_checkout, checkin: entry.photo_front_checkin },
                                        { label: "Traseira", checkout: entry.photo_back_checkout, checkin: entry.photo_back_checkin },
                                        { label: "Esquerda", checkout: entry.photo_left_checkout, checkin: entry.photo_left_checkin },
                                        { label: "Direita", checkout: entry.photo_right_checkout, checkin: entry.photo_right_checkin },
                                        { label: "Painel", checkout: entry.photo_dashboard_checkout, checkin: entry.photo_dashboard_checkin },
                                      ]
                                        .filter((pair) => pair.checkout || pair.checkin)
                                        .map((pair) => (
                                          <div key={pair.label} className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">{pair.label}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <p className="text-[10px] text-muted-foreground mb-1">Saída</p>
                                                {pair.checkout ? (
                                                  <SignedImage storagePath={pair.checkout} alt={`${pair.label} - Saída`} className="w-full h-32 object-cover rounded-lg border" />
                                                ) : (
                                                  <div className="w-full h-32 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground bg-muted/30">
                                                    Sem foto
                                                  </div>
                                                )}
                                              </div>
                                              <div>
                                                <p className="text-[10px] text-muted-foreground mb-1">Devolução</p>
                                                {pair.checkin ? (
                                                  <SignedImage storagePath={pair.checkin} alt={`${pair.label} - Devolução`} className="w-full h-32 object-cover rounded-lg border" />
                                                ) : (
                                                  <div className="w-full h-32 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground bg-muted/30">
                                                    Sem foto
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedHistory.map((entry) => (
                  <Card key={entry.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {entry.vehicles?.name} - {entry.vehicles?.plate}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.profiles?.full_name} • {entry.destination || "Sem destino"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.checkout_date), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          <Badge variant={entry.status === "checked_out" ? "default" : "secondary"} className="text-[10px]">
                            {entry.status === "checked_out" ? "Em Uso" : "Devolvido"}
                          </Badge>
                          {entry.km_checkin !== null && (
                            <span className="text-xs font-medium text-primary">
                              {(entry.km_checkin - entry.km_checkout).toLocaleString()} km
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(entry); setAiEstimation(null); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalhes da Movimentação</DialogTitle>
                            </DialogHeader>
                            {selectedEntry && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Veículo</p>
                                    <p className="font-semibold">{selectedEntry.vehicles?.name} - {selectedEntry.vehicles?.plate}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                                    <p className="font-semibold">{selectedEntry.profiles?.full_name}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteDialog({ open: true, entry })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}

                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {filteredHistory.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Itens por página:</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={currentPage === 1} title="Primeira">
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} title="Anterior">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="Próxima">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} title="Última">
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Carregamentos de Plataforma */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <PlugZap className="w-4 h-4 md:w-5 md:h-5 text-info" />
                Carregamentos de Plataforma
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {filteredCharging.length} sessão(ões) · Horímetro acumulado:{" "}
                <span className="font-semibold text-foreground">
                  {platformHourMeter.reduce((a, b) => a + b.hours, 0).toFixed(2)}h
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={exportChargingPDF}>
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={exportChargingExcel}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          {platformHourMeter.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {platformHourMeter.map((p) => (
                <div key={p.plate} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Horímetro</p>
                  <p className="font-semibold text-sm truncate">{p.vehicle}</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-mono text-muted-foreground">{p.plate}</span>
                    <span className="text-lg font-bold text-info">{p.hours.toFixed(2)}h</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.sessions} sessão(ões)</p>
                </div>
              ))}
            </div>
          )}

          {filteredCharging.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhuma sessão de carregamento no período/filtro atual
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Colocou p/ carregar</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Retirou da carga</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCharging.slice(0, 200).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.vehicle_name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.vehicle_plate}</TableCell>
                      <TableCell>{s.started_by_name}</TableCell>
                      <TableCell>{format(new Date(s.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>{s.ended_by_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {s.ended_at
                          ? format(new Date(s.ended_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : <span className="text-muted-foreground italic">Em andamento</span>}
                      </TableCell>
                      <TableCell className="font-mono">
                        {s.duration_hours >= 1
                          ? `${Math.floor(s.duration_hours)}h ${Math.round((s.duration_hours % 1) * 60)}min`
                          : `${Math.round(s.duration_hours * 60)}min`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.ended_at ? "secondary" : "default"} className={s.ended_at ? "" : "bg-info text-info-foreground"}>
                          {s.ended_at ? "Finalizada" : "Em andamento"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredCharging.length > 200 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Mostrando 200 de {filteredCharging.length} sessões — exporte para ver todas
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <DeleteWithReasonDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, entry: open ? deleteDialog.entry : null })}
        onConfirm={handleDeleteEntry}
        title="Excluir Registro do Histórico"
        description="Esta ação é irreversível. O registro será removido permanentemente do histórico."
        itemName={deleteDialog.entry ? `${deleteDialog.entry.vehicles?.name} (${deleteDialog.entry.vehicles?.plate}) - ${deleteDialog.entry.profiles?.full_name}` : ""}
      />
    </div>
  );
}
