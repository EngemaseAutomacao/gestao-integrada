import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SignedImage } from "@/components/SignedImage";
import { Search, FileText, FileSpreadsheet, Filter, X, CheckSquare, Clock, ArrowRight, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { PendingCheckoutsCard } from "@/components/dashboard/PendingCheckoutsCard";
import { ToolStats } from "@/components/dashboard/ToolStats";
import { ToolCard } from "@/components/dashboard/ToolCard";

interface Tool {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  brand: string | null;
  condition: string | null;
  quantity_available: number;
  quantity_total: number;
  employee_only: boolean;
}

const conditionLabels: Record<string, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Regular",
  poor: "Ruim",
  needs_maintenance: "Precisa Manutenção",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const { data: cachedTools, saveToCache } = useOfflineStorage<Tool[]>("dashboard_tools", []);
  const [tools, setTools] = useState<Tool[]>(cachedTools || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingCollapsed, setPendingCollapsed] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("pending-banner-collapsed") === "1"
  );
  const togglePendingCollapsed = () => {
    setPendingCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("pending-banner-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  
  
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCheckouts, setSelectedCheckouts] = useState<Set<string>>(new Set());
  const [bulkReturnLoading, setBulkReturnLoading] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendCheckoutId, setExtendCheckoutId] = useState<string | null>(null);
  const [extendToolName, setExtendToolName] = useState("");
  const [extendDate, setExtendDate] = useState<Date | undefined>(undefined);
  const [extendDays, setExtendDays] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [catalogSelectMode, setCatalogSelectMode] = useState(false);
  // toolId -> selected TAG ("" when not yet chosen / not applicable)
  const [catalogSelected, setCatalogSelected] = useState<Map<string, string>>(new Map());
  const [catalogTagError, setCatalogTagError] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const toggleCatalogTool = (id: string) =>
    setCatalogSelected(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, "");
      return next;
    });
  const setCatalogTag = (id: string, tag: string) =>
    setCatalogSelected(prev => {
      const next = new Map(prev);
      next.set(id, tag);
      return next;
    });
  const exitCatalogSelect = () => { setCatalogSelectMode(false); setCatalogSelected(new Map()); };
  const confirmCatalogBulk = () => {
    setCatalogTagError("");
    if (catalogSelected.size === 0) { toast.error("Selecione ao menos uma ferramenta"); return; }
    // Validate TAG chosen for multi-tag tools
    for (const [toolId, tag] of catalogSelected) {
      const t = tools?.find((x: any) => x.id === toolId);
      if (!t) continue;
      const tags = (t.tag || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      if (tags.length > 1 && !tag) {
        const msg = `Selecione qual unidade de "${t.name}" você está retirando antes de continuar.`;
        setCatalogTagError(msg);
        toast.error(msg);
        return;
      }
    }
    const ids = Array.from(catalogSelected.keys()).join(",");
    const tagsParam = Array.from(catalogSelected.entries())
      .filter(([, tag]) => !!tag)
      .map(([id, tag]) => `${id}:${encodeURIComponent(tag)}`)
      .join(",");
    const qs = `bulk=1&toolIds=${ids}${tagsParam ? `&tags=${tagsParam}` : ""}`;
    navigate(`/ferramentas/retirada?${qs}`);
  };

  const { data: pendingCheckouts } = useQuery({
    queryKey: ["pending-tool-checkouts", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      return api.get<any[]>("/tool-checkouts", { status: "checked_out", scope: "mine" });
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTools = async () => {
    if (!isOnline) {
      if (cachedTools && cachedTools.length > 0) {
        const filteredTools = cachedTools.filter(tool => {
          if (profile?.category === "third_party" && tool.employee_only) return false;
          return true;
        });
        setTools(filteredTools);
        toast.info("Modo offline - usando dados em cache");
      }
      setLoading(false);
      return;
    }

    try {
      const data = await api.get<Tool[]>("/tools");

      const filteredTools = data?.filter(tool => {
        if (profile?.category === "third_party" && tool.employee_only) return false;
        return true;
      }) || [];

      setTools(filteredTools as Tool[]);
      saveToCache((data || []) as Tool[]);
    } catch (error: any) {
      if (cachedTools && cachedTools.length > 0) {
        const filteredTools = cachedTools.filter(tool => {
          if (profile?.category === "third_party" && tool.employee_only) return false;
          return true;
        });
        setTools(filteredTools);
        toast.info("Usando dados em cache");
      } else {
        toast.error("Erro ao carregar ferramentas", { description: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const brands = useMemo(() => {
    const u = [...new Set(tools.map(t => t.brand).filter(Boolean))] as string[];
    return u.sort();
  }, [tools]);

  const conditions = useMemo(() => {
    const u = [...new Set(tools.map(t => t.condition).filter(Boolean))] as string[];
    return u.sort();
  }, [tools]);

  const hasActiveFilters =
    brandFilter !== "all" || conditionFilter !== "all" || availabilityFilter !== "all" || categoryFilter !== "all";

  const clearFilters = () => {
    setBrandFilter("all");
    setConditionFilter("all");
    setAvailabilityFilter("all");
    setCategoryFilter("all");
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.brand?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = brandFilter === "all" || tool.brand === brandFilter;
    const matchesCondition = conditionFilter === "all" || tool.condition === conditionFilter;
    const matchesAvailability =
      availabilityFilter === "all" ||
      (availabilityFilter === "available" && tool.quantity_available > 0) ||
      (availabilityFilter === "unavailable" && tool.quantity_available === 0);
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "employee_only" && tool.employee_only) ||
      (categoryFilter === "all_users" && !tool.employee_only);

    return matchesSearch && matchesBrand && matchesCondition && matchesAvailability && matchesCategory;
  });

  const handleCheckout = (toolId: string) => {
    navigate(`/ferramentas/retirada?toolId=${toolId}`);
  };

  const handleCheckin = (checkoutId: string) => {
    navigate(`/ferramentas/devolucao?checkoutId=${checkoutId}`);
  };

  const handleExtendDate = async () => {
    if (!extendCheckoutId || !extendDate || !profile?.id) return;
    setExtendLoading(true);
    try {
      // O servidor também avisa os administradores.
      await api.post(`/tool-checkouts/${extendCheckoutId}/extend`, {
        estimated_return_date: extendDate.toISOString(),
      });

      toast.success("Data de devolução prorrogada!");
      queryClient.invalidateQueries({ queryKey: ["pending-tool-checkouts"] });
      setExtendDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao prorrogar", { description: error.message });
    } finally {
      setExtendLoading(false);
    }
  };

  const openExtendDialog = (checkoutId: string, toolName: string) => {
    setExtendCheckoutId(checkoutId);
    setExtendToolName(toolName);
    setExtendDays("");
    setExtendDate(undefined);
    setExtendDialogOpen(true);
  };

  const handleExtendDaysChange = (value: string) => {
    setExtendDays(value);
    const days = parseInt(value, 10);
    setExtendDate(Number.isNaN(days) ? undefined : addDays(new Date(), days));
  };

  const toggleSelectCheckout = (id: string) => {
    setSelectedCheckouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!pendingCheckouts) return;
    if (selectedCheckouts.size === pendingCheckouts.length) {
      setSelectedCheckouts(new Set());
    } else {
      setSelectedCheckouts(new Set(pendingCheckouts.map((c: any) => c.id)));
    }
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedCheckouts(new Set());
  };

  const handleBulkReturn = async () => {
    if (selectedCheckouts.size === 0 || !profile?.id) return;
    setBulkReturnLoading(true);
    try {
      const ids = Array.from(selectedCheckouts);
      await api.post("/tool-checkouts/checkin", { ids });

      toast.success(`${ids.length} ferramenta(s) devolvida(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["pending-tool-checkouts"] });
      exitMultiSelect();
    } catch (error: any) {
      toast.error("Erro ao devolver ferramentas", { description: error.message });
    } finally {
      setBulkReturnLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const available = tools.reduce((acc, t) => acc + t.quantity_available, 0);
  const total = tools.reduce((acc, t) => acc + t.quantity_total, 0);
  const inUse = tools.reduce((acc, t) => acc + (t.quantity_total - t.quantity_available), 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 pb-3 sm:pb-4">
        <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-5 sm:px-8 lg:px-12 pt-6 sm:pt-8 lg:pt-10 pb-20 sm:pb-24 lg:pb-28 rounded-b-3xl lg:rounded-b-[2rem]">
          <div className="absolute -top-10 -right-10 w-40 h-40 lg:w-96 lg:h-96 rounded-full bg-white/10 blur-2xl lg:blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-6 lg:right-32 w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative max-w-6xl mx-auto">
            <p className="text-[10px] lg:text-xs uppercase tracking-[0.25em] opacity-80 font-semibold">
              Módulo · Ferramentas
            </p>
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold leading-tight">
              Painel e Catálogo
            </h1>
            <p className="text-[11px] sm:text-sm lg:text-base opacity-90 line-clamp-2 lg:mt-1 max-w-2xl">
              Busque, filtre e gerencie retiradas e devoluções de ferramentas
            </p>
          </div>
        </header>

        <div className="px-3 sm:px-6 lg:px-12 -mt-14 sm:-mt-16 relative z-10 max-w-6xl mx-auto w-full space-y-3 sm:space-y-4">
          <div className="grid gap-2 sm:gap-4 grid-cols-3">
            <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Disponíveis</p>
              <p className="text-xl sm:text-3xl font-bold text-success mt-1">{available}</p>
            </div>
            <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
              <p className="text-xl sm:text-3xl font-bold mt-1">{total}</p>
            </div>
            <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Em Uso</p>
              <p className="text-xl sm:text-3xl font-bold text-warning mt-1">{inUse}</p>
            </div>
          </div>

          {pendingCheckouts && pendingCheckouts.length > 0 && (
            pendingCollapsed ? (
              <button
                type="button"
                onClick={togglePendingCollapsed}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-warning/40 bg-warning/5 hover:bg-warning/10 transition-colors text-left"
                aria-label="Expandir pendências"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-warning">
                  <Clock className="w-3.5 h-3.5" />
                  {pendingCheckouts.length} pendência{pendingCheckouts.length > 1 ? "s" : ""}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-warning" />
              </button>
            ) : (
              <Card className="border-warning/50 bg-warning/5 relative">
                <button
                  type="button"
                  onClick={togglePendingCollapsed}
                  className="absolute top-1.5 right-1.5 z-10 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Minimizar"
                  title="Minimizar"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {pendingCheckouts.length} {pendingCheckouts.length > 1 ? "devoluções pendentes" : "devolução pendente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Acesse a página de pendências para devolver.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/devolucoes-pendentes")}
                    className="gap-1 shrink-0"
                  >
                    Ver pendências <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            )
          )}


        </div>
      </div>


      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Catálogo</CardTitle>
              <CardDescription>
                {filteredTools.length} de {tools.length} ferramentas
              </CardDescription>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button
                size="sm"
                variant="default"
                className="text-xs gap-1"
                onClick={() => navigate("/ferramentas/retirada?bulk=1")}
              >
                <CheckSquare className="w-3.5 h-3.5" /> Saída em Lote
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={async () => {
                  const headers = ["Nome", "Tag", "Marca", "Disponível", "Total", "Em Uso"];
                  const rows = filteredTools.map(t => [
                    t.name,
                    t.tag || "-",
                    t.brand || "-",
                    String(t.quantity_available),
                    String(t.quantity_total),
                    String(t.quantity_total - t.quantity_available),
                  ]);
                  await exportToPDF({ title: "Relatório de Ferramentas", headers, rows, filename: "ferramentas", generatedBy: profile?.full_name });
                  toast.success("PDF exportado!");
                }}
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => {
                  const headers = ["Nome", "Tag", "Marca", "Disponível", "Total", "Em Uso"];
                  const rows = filteredTools.map(t => [
                    t.name,
                    t.tag || "-",
                    t.brand || "-",
                    String(t.quantity_available),
                    String(t.quantity_total),
                    String(t.quantity_total - t.quantity_available),
                  ]);
                  exportToExcel({ title: "Relatório de Ferramentas", headers, rows, filename: "ferramentas", generatedBy: profile?.full_name });
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
                placeholder="Buscar por nome, descrição, TAG ou marca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Buscar ferramenta"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
              aria-label="Mostrar filtros avançados"
              aria-pressed={showFilters}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 bg-muted/50 rounded-lg border animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Marca</label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as marcas</SelectItem>
                    {brands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Disponibilidade</label>
                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="unavailable">Indisponível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Acesso</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="employee_only">Apenas Funcionários</SelectItem>
                    <SelectItem value="all_users">Todos os Usuários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                    <X className="w-3 h-3" /> Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            {filteredTools.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma ferramenta encontrada
              </p>
            ) : (
              filteredTools.map((tool) => {
                const userCheckouts = pendingCheckouts?.filter((c: any) => c.tool_id === tool.id) || [];
                const isSelected = catalogSelected.has(tool.id);
                const isDisabled = catalogSelectMode && tool.quantity_available <= 0;
                if (catalogSelectMode) {
                  const tags = (tool.tag || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                  const selectedTag = catalogSelected.get(tool.id) || "";
                  // TAGs already in use by other active checkouts
                  const allCheckoutsForTool = (pendingCheckouts || []).filter((c: any) => c.tool_id === tool.id);
                  const usedTags: string[] = allCheckoutsForTool.map((c: any) => c.selected_tag).filter(Boolean);
                  const availableTags = tags.filter(t => !usedTags.includes(t));
                  return (
                    <div key={tool.id} className="relative">
                      <div className={cn("pointer-events-none transition-opacity", isDisabled && "opacity-50")}>
                        <ToolCard
                          tool={tool}
                          userCheckouts={userCheckouts}
                          conditionLabels={conditionLabels}
                          onNavigate={navigate}
                          onEnlargeImage={setEnlargedImage}
                          onCheckout={handleCheckout}
                          onCheckin={handleCheckin}
                          onExtend={openExtendDialog}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => !isDisabled && toggleCatalogTool(tool.id)}
                        className={cn(
                          "absolute inset-0 rounded-lg border-2 transition-all",
                          isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/40",
                          isDisabled && "cursor-not-allowed"
                        )}
                        aria-label={`Selecionar ${tool.name}`}
                      />
                      <div className="absolute top-2 right-2 z-10 pointer-events-none">
                        <div className="bg-background border-2 border-primary rounded p-0.5 shadow">
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                        </div>
                      </div>
                      {isSelected && tags.length > 1 && (
                        <div className="absolute bottom-2 left-2 right-2 z-20 bg-background/95 backdrop-blur border rounded-md p-2 shadow">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">
                            Selecione a unidade:
                          </p>
                          <Select value={selectedTag} onValueChange={(v) => setCatalogTag(tool.id, v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={availableTags.length === 0 ? "Todas em uso" : "Escolha a TAG"} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTags.map(t => (
                                <SelectItem key={t} value={t}>TAG {t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    userCheckouts={userCheckouts}
                    conditionLabels={conditionLabels}
                    onNavigate={navigate}
                    onEnlargeImage={setEnlargedImage}
                    onCheckout={handleCheckout}
                    onCheckin={handleCheckin}
                    onExtend={openExtendDialog}
                  />
                );
              })
            )}
          </div>
          {catalogSelectMode && (
            <div className="shrink-0 flex flex-col gap-2 p-3 border-t bg-background sticky bottom-0">
              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className={cn("text-sm font-medium", catalogTagError ? "text-destructive" : "sr-only")}
              >
                {catalogTagError}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm font-medium">
                  {catalogSelected.size} selecionada{catalogSelected.size === 1 ? "" : "s"}
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={exitCatalogSelect} className="flex-1 sm:flex-none">Cancelar</Button>
                  <Button size="sm" disabled={catalogSelected.size === 0} onClick={confirmCatalogBulk} className="flex-1 sm:flex-none">
                    Continuar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Prorrogar Devolução</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o novo prazo de devolução para <strong>{extendToolName}</strong>:
            </p>
            <Select value={extendDays} onValueChange={handleExtendDaysChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Dia</SelectItem>
                <SelectItem value="7">7 Dias</SelectItem>
                <SelectItem value="15">15 Dias</SelectItem>
                <SelectItem value="30">30 Dias</SelectItem>
              </SelectContent>
            </Select>
            {extendDate && (
              <p className="text-sm text-center text-muted-foreground">
                Nova devolução: <strong>{format(extendDate, "dd/MM/yyyy", { locale: ptBR })}</strong>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExtendDate} disabled={!extendDate || extendLoading}>
              {extendLoading ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto da ferramenta</DialogTitle>
          </DialogHeader>
          {enlargedImage && (
            enlargedImage.startsWith("http") ? (
              <img src={enlargedImage} alt="Foto ampliada" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
            ) : (
              <SignedImage storagePath={enlargedImage} alt="Foto ampliada" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
