import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Eye, FileText, FileSpreadsheet, Trash2, X, List, Clock, ChevronDown, ChevronRight, SlidersHorizontal, Pencil, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AssetTimeline } from "@/components/admin/AssetTimeline";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { DeleteWithReasonDialog } from "@/components/DeleteWithReasonDialog";
import { HistorySkeleton } from "@/components/PageSkeleton";

type HistoryCategory = "engemase_employee" | "third_party" | "socios" | null;

interface HistoryEntry {
  id: string;
  checkout_date: string;
  checkin_date: string | null;
  status: string;
  construction_site: string | null;
  selected_tag: string | null;
  estimated_return_date: string | null;
  checkout_photo_url: string | null;
  checkin_photo_url: string | null;
  checkout_signature_url: string | null;
  checkin_signature_url: string | null;
  tools: {
    name: string;
    tag: string | null;
  } | null;
  profiles: {
    full_name: string;
    category: HistoryCategory;
  } | null;
  checked_out_by_profile: {
    full_name: string;
  } | null;
  checked_in_by_profile: {
    full_name: string;
  } | null;
  notes: string | null;
}

export default function AdminHistory() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: history = [], isLoading: loading } = useQuery<HistoryEntry[]>({
    queryKey: ["admin-history"],
    queryFn: async () => {
      const data = await api.get<any[]>("/tool-checkouts", { limit: 10000 });
      return data.map((entry) => ({
        ...entry,
        tools: entry.tools ? { name: entry.tools.name || "Ferramenta", tag: entry.tools.tag } : null,
        profiles: {
          full_name: entry.profiles?.full_name || "Usuário não encontrado",
          category: entry.profiles?.category as HistoryCategory,
        },
      })) as HistoryEntry[];
    },
    staleTime: 30_000,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; entry: HistoryEntry | null }>({ open: false, entry: null });
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<HistoryEntry | null>(null);
  const [editForm, setEditForm] = useState({ construction_site: "", notes: "", checkout_date: "", checkin_date: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (entry: HistoryEntry) => {
    const toLocal = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      const off = d.getTimezoneOffset();
      const local = new Date(d.getTime() - off * 60000);
      return local.toISOString().slice(0, 16);
    };
    setEditForm({
      construction_site: entry.construction_site || "",
      notes: entry.notes || "",
      checkout_date: toLocal(entry.checkout_date),
      checkin_date: toLocal(entry.checkin_date),
    });
    setEditEntry(entry);
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSavingEdit(true);
    try {
      const payload = {
        construction_site: editForm.construction_site.trim() || null,
        notes: editForm.notes.trim() || null,
        checkout_date: new Date(editForm.checkout_date).toISOString(),
        checkin_date: editForm.checkin_date ? new Date(editForm.checkin_date).toISOString() : null,
      };
      // O servidor registra a alteração na auditoria.
      await api.patch(`/tool-checkouts/${editEntry.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ["admin-history"] });
      toast.success("Registro atualizado com sucesso");
      setEditEntry(null);
    } catch (err) {
      console.error("Erro ao editar registro:", err);
      toast.error("Erro ao atualizar registro");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEntry = async (reason: string) => {
    if (!deleteDialog.entry) return;
    try {
      // Excluir uma retirada ainda aberta devolve a unidade ao estoque; o motivo vai para a auditoria.
      await api.delete(`/tool-checkouts/${deleteDialog.entry.id}`, { reason });

      queryClient.invalidateQueries({ queryKey: ["admin-history"] });
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
      entry.tools?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.construction_site && entry.construction_site.toLowerCase().includes(searchQuery.toLowerCase()));
    
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

  const getCategoryLabel = (category: HistoryCategory | undefined) => {
    if (category === "engemase_employee") return "Funcionário";
    if (category === "socios") return "Sócio";
    if (category === "third_party") return "Terceirizado";
    return "-";
  };

  const getCategoryBadge = (category: HistoryCategory | undefined) => {
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

  const isOverdue = (estimatedReturnDate: string | null, status: string) => {
    if (!estimatedReturnDate || status !== "checked_out") return false;
    return new Date(estimatedReturnDate) < new Date();
  };

  const exportHistoryPDF = async () => {
    if (filteredHistory.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    const headers = ["Ferramenta", "TAG", "Usuário", "Categoria", "Obra", "Retirada", "Devolução", "Status", "Observações"];
    const rows = filteredHistory.map((e) => [
      e.tools?.name,
      e.selected_tag || e.tools?.tag || "-",
      e.profiles?.full_name || "Usuário não encontrado",
      getCategoryLabel(e.profiles?.category),
      e.construction_site || "-",
      format(new Date(e.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      e.checkin_date ? format(new Date(e.checkin_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      e.status === "checked_out" ? "Em Uso" : "Devolvida",
      e.notes || "-",
    ]);
    await exportToPDF({
      title: "Histórico de Ferramentas",
      subtitle: `Total: ${filteredHistory.length} registros`,
      headers, rows,
      filename: `historico-ferramentas-${format(new Date(), "yyyy-MM-dd")}`,
      orientation: "landscape",
    });
    toast.success("PDF exportado!");
  };

  const exportHistoryExcel = () => {
    if (filteredHistory.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    const headers = ["Ferramenta", "TAG", "Usuário", "Categoria", "Obra", "Retirada", "Devolução", "Status", "Retirado por", "Devolvido por", "Observações"];
    const rows = filteredHistory.map((e) => [
      e.tools?.name,
      e.selected_tag || e.tools?.tag || "-",
      e.profiles?.full_name || "Usuário não encontrado",
      getCategoryLabel(e.profiles?.category),
      e.construction_site || "-",
      format(new Date(e.checkout_date), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      e.checkin_date ? format(new Date(e.checkin_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      e.status === "checked_out" ? "Em Uso" : "Devolvida",
      e.checked_out_by_profile?.full_name || "-",
      e.checked_in_by_profile?.full_name || "-",
      e.notes || "-",
    ]);
    exportToExcel({
      title: "Histórico de Ferramentas",
      subtitle: `Total: ${filteredHistory.length} registros`,
      headers, rows,
      filename: `historico-ferramentas-${format(new Date(), "yyyy-MM-dd")}`,
    });
    toast.success("Excel exportado!");
  };

  if (loading) {
    return <HistorySkeleton />;
  }

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
      {/* Barra de ações + filtros recolhíveis */}
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
            <Button variant="outline" size="sm" onClick={exportHistoryPDF} className="gap-2">
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportHistoryExcel} className="gap-2">
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
                    placeholder="Buscar ferramenta, usuário ou obra..."
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
                    <SelectItem value="checked_in">Devolvida</SelectItem>
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
                description: `${entry.tools?.name}${entry.construction_site ? ` — ${entry.construction_site}` : ""}`,
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
                      <TableHead className="min-w-[180px]">Ferramenta</TableHead>
                      <TableHead className="min-w-[140px]">Obra</TableHead>
                      <TableHead className="min-w-[160px]">Usuário</TableHead>
                      <TableHead className="w-[120px]">Categoria</TableHead>
                      <TableHead className="w-[140px]">Retirada</TableHead>
                      <TableHead className="w-[140px]">Devolução</TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
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
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          >
                            <TableCell className="w-8 pr-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col leading-tight">
                                <span className="truncate max-w-[240px]" title={entry.tools?.name}>{entry.tools?.name}</span>
                                {(entry.selected_tag || entry.tools?.tag) && (
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                    TAG: {entry.selected_tag || entry.tools?.tag}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[180px]" title={entry.construction_site || ""}>
                              {entry.construction_site || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-[200px]" title={entry.profiles?.full_name}>
                              {entry.profiles?.full_name}
                            </TableCell>
                            <TableCell>{getCategoryBadge(entry.profiles?.category)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {format(new Date(entry.checkout_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {entry.checkin_date
                                ? format(new Date(entry.checkin_date), "dd/MM/yy HH:mm", { locale: ptBR })
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.status === "checked_out" ? (
                                isOverdue(entry.estimated_return_date, entry.status) ? (
                                  <Badge variant="destructive" className="text-[10px] py-0 h-5">Atrasado</Badge>
                                ) : (
                                  <Badge variant="default" className="text-[10px] py-0 h-5">Em Uso</Badge>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-[10px] py-0 h-5">Devolvida</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
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
                              <TableCell colSpan={9} className="p-4">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ferramenta</p>
                                      <p className="font-semibold text-sm">{entry.tools?.name}</p>
                                      {(entry.selected_tag || entry.tools?.tag) && (
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                                          TAG: {entry.selected_tag || entry.tools?.tag}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Usuário</p>
                                      <p className="text-sm">{entry.profiles?.full_name}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Obra</p>
                                      <p className="text-sm">{entry.construction_site || "Não informado"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                                      <Badge variant={entry.status === "checked_out" ? "default" : "secondary"}>
                                        {entry.status === "checked_out" ? "Em Uso" : "Devolvida"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Data de Retirada</p>
                                      <p className="text-sm">{format(new Date(entry.checkout_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                      <p className="text-xs text-muted-foreground">Por: {entry.checked_out_by_profile?.full_name || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Data de Devolução</p>
                                      <p className="text-sm">
                                        {entry.checkin_date
                                          ? format(new Date(entry.checkin_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                          : "Não devolvida"}
                                      </p>
                                      {entry.checked_in_by_profile && (
                                        <p className="text-xs text-muted-foreground">Por: {entry.checked_in_by_profile.full_name}</p>
                                      )}
                                    </div>
                                  </div>
                                  {entry.notes && (
                                    <div className="pt-3 border-t">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
                                      <p className="text-sm mt-1 whitespace-pre-wrap">{entry.notes}</p>
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <div className="pt-3 border-t flex flex-wrap gap-2 justify-start">
                                      <Button size="sm" variant="outline" onClick={() => openEdit(entry)} className="gap-2">
                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setDeleteDialog({ open: true, entry })} className="gap-2 text-destructive hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                                      </Button>
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
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                            {entry.tools?.name}
                            {(entry.selected_tag || entry.tools?.tag) && (
                              <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 uppercase">
                                {entry.selected_tag || entry.tools?.tag}
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground">{entry.profiles?.full_name}</p>
                          {entry.construction_site && (
                            <p className="text-xs text-muted-foreground">Obra: {entry.construction_site}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={entry.status === "checked_out" ? "default" : "secondary"} className="text-xs">
                            {entry.status === "checked_out" ? "Em Uso" : "Devolvida"}
                          </Badge>
                          {isOverdue(entry.estimated_return_date, entry.status) && (
                            <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Retirada: {format(new Date(entry.checkout_date), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                          {entry.checkin_date && (
                            <p>Devolução: {format(new Date(entry.checkin_date), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(entry)}>
                                <Eye className="w-4 h-4 mr-1" />
                                Ver
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
                                      <p className="text-sm font-medium text-muted-foreground">Ferramenta</p>
                                      <p className="font-semibold">
                                        {selectedEntry.tools?.name}
                                        {(selectedEntry.selected_tag || selectedEntry.tools?.tag) && (
                                          <span className="ml-2 text-xs font-mono text-muted-foreground bg-muted px-1 rounded uppercase">
                                            TAG: {selectedEntry.selected_tag || selectedEntry.tools?.tag}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                                      <p className="font-semibold">{selectedEntry.profiles?.full_name}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Obra</p>
                                      <p>{selectedEntry.construction_site || "Não informado"}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                                      <Badge variant={selectedEntry.status === "checked_out" ? "default" : "secondary"}>
                                        {selectedEntry.status === "checked_out" ? "Em Uso" : "Devolvida"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Data de Retirada</p>
                                      <p>{format(new Date(selectedEntry.checkout_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Data de Devolução</p>
                                      <p>
                                        {selectedEntry.checkin_date 
                                          ? format(new Date(selectedEntry.checkin_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                          : "Não devolvida"}
                                      </p>
                                    </div>
                                  </div>
                                  {selectedEntry.notes && (
                                    <div className="pt-4 border-t">
                                      <p className="text-sm font-medium text-muted-foreground">Observações</p>
                                      <p className="mt-1">{selectedEntry.notes}</p>
                                    </div>
                                  )}
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
                    </CardContent>
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

      <DeleteWithReasonDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, entry: open ? deleteDialog.entry : null })}
        onConfirm={handleDeleteEntry}
        title="Excluir Registro do Histórico"
        description="Esta ação é irreversível. O registro será removido permanentemente do histórico."
        itemName={deleteDialog.entry ? `${deleteDialog.entry.tools?.name} - ${deleteDialog.entry.profiles?.full_name}` : ""}
      />

      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>
              {editEntry?.tools?.name} — {editEntry?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-site">Obra</Label>
              <Input
                id="edit-site"
                value={editForm.construction_site}
                onChange={(e) => setEditForm({ ...editForm, construction_site: e.target.value })}
                placeholder="Nome da obra"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-checkout">Data de Retirada</Label>
                <Input
                  id="edit-checkout"
                  type="datetime-local"
                  value={editForm.checkout_date}
                  onChange={(e) => setEditForm({ ...editForm, checkout_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-checkin">Data de Devolução</Label>
                <Input
                  id="edit-checkin"
                  type="datetime-local"
                  value={editForm.checkin_date}
                  onChange={(e) => setEditForm({ ...editForm, checkin_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editForm.checkout_date}>
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
