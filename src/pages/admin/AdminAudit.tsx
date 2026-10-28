import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Eye, Shield, Wrench, Car, User, LogIn, LogOut, UserCheck, Trash2, ArrowRightLeft, X, CalendarIcon, FileText, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { HistorySkeleton } from "@/components/PageSkeleton";
import { format, subDays, subMonths, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  user_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  checkout: "Retirada",
  checkin: "Devolução",
  user_registered: "Novo Cadastro",
  user_approved: "Usuário Aprovado",
  delete: "Exclusão",
  delete_history: "Exclusão de Histórico",
  transfer: "Transferência",
};

const ENTITY_LABELS: Record<string, string> = {
  tool: "Ferramenta",
  vehicle: "Veículo",
  user: "Usuário",
  tool_checkout: "Checkout (Ferramenta)",
  vehicle_checkout: "Checkout (Veículo)",
};

function getActionIcon(action: string, entityType: string) {
  if (action === "delete" || action === "delete_history") return <Trash2 className="w-4 h-4 text-red-500" />;
  if (action === "transfer") return <ArrowRightLeft className="w-4 h-4 text-cyan-500" />;
  if (entityType === "vehicle" || entityType === "vehicle_checkout") return <Car className="w-4 h-4 text-blue-500" />;
  if (entityType === "user") return <User className="w-4 h-4 text-purple-500" />;
  if (action === "checkout") return <LogOut className="w-4 h-4 text-orange-500" />;
  if (action === "checkin") return <LogIn className="w-4 h-4 text-green-500" />;
  if (action === "user_approved") return <UserCheck className="w-4 h-4 text-emerald-500" />;
  return <Wrench className="w-4 h-4 text-muted-foreground" />;
}

function getActionColor(action: string): string {
  switch (action) {
    case "checkout": return "border-l-orange-500";
    case "checkin": return "border-l-green-500";
    case "user_registered": return "border-l-blue-500";
    case "user_approved": return "border-l-emerald-500";
    case "delete": case "delete_history": return "border-l-red-600";
    case "transfer": return "border-l-cyan-500";
    default: return "border-l-primary";
  }
}

function buildDescription(log: AuditLog): string {
  const d = log.details || {};
  switch (log.action) {
    case "checkout":
      if (log.entity_type === "tool")
        return `Retirou a ferramenta "${d.tool_name || ""}"${d.construction_site ? ` para obra "${d.construction_site}"` : ""}`;
      if (log.entity_type === "vehicle")
        return `Retirou o veículo "${d.vehicle_name || ""} (${d.plate || ""})"${d.destination ? ` - Destino: ${d.destination}` : ""}`;
      return "";
    case "checkin":
      if (log.entity_type === "tool") return `Devolveu a ferramenta "${d.tool_name || ""}"`;
      if (log.entity_type === "vehicle") return `Devolveu o veículo "${d.vehicle_name || ""} (${d.plate || ""})"`;
      return "";
    case "user_registered":
      return `Novo usuário: ${d.email || ""} (${d.category === "engemase_employee" ? "Funcionário" : d.category === "third_party" ? "Terceirizado" : "Sócio"})`;
    case "user_approved":
      return `Aprovou "${d.approved_user || ""}" (${d.email || ""})`;
    case "delete":
      if (log.entity_type === "tool") return `Excluiu ferramenta "${d.tool_name || ""}"`;
      if (log.entity_type === "vehicle") return `Excluiu veículo "${d.vehicle_name || ""} (${d.plate || ""})"`;
      return `Excluiu registro`;
    case "delete_history":
      return `Excluiu histórico: ${d.tool_name || d.vehicle_name || ""} - Usuário: ${d.user_name || ""} - Motivo: ${d.reason || "Não informado"}`;
    case "transfer":
      return `Transferência de ${d.from_user || ""} para ${d.to_user || ""}`;
    default:
      return JSON.stringify(d);
  }
}

export default function AdminAudit() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  const loadLogs = async () => {
    try {
      setLogs(await api.get<AuditLog[]>("/logs", { limit: 1000 }));
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case "7d": return { start: subDays(now, 7), end: now };
      case "30d": return { start: subDays(now, 30), end: now };
      case "90d": return { start: subDays(now, 90), end: now };
      case "6m": return { start: subMonths(now, 6), end: now };
      default: return null;
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterEntity !== "all" && log.entity_type !== filterEntity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const desc = buildDescription(log).toLowerCase();
      const name = (log.user_name || "").toLowerCase();
      if (!desc.includes(q) && !name.includes(q)) return false;
    }
    const dateRange = getDateRange();
    if (dateRange) {
      const logDate = new Date(log.created_at);
      if (!isAfter(logDate, startOfDay(dateRange.start)) || !isBefore(logDate, endOfDay(dateRange.end))) return false;
    }
    return true;
  });

  const hasActiveFilters = searchQuery || filterAction !== "all" || filterEntity !== "all" || periodFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterAction("all");
    setFilterEntity("all");
    setPeriodFilter("all");
  };

  const exportPDF = async () => {
    if (filteredLogs.length === 0) { toast.error("Nenhum registro para exportar"); return; }
    const headers = ["Data/Hora", "Usuário", "Ação", "Tipo", "Descrição"];
    const rows = filteredLogs.map((l) => [
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      l.user_name || "Sistema",
      ACTION_LABELS[l.action] || l.action,
      ENTITY_LABELS[l.entity_type] || l.entity_type,
      buildDescription(l),
    ]);
    await exportToPDF({
      title: "Painel de Auditoria",
      subtitle: `Total: ${filteredLogs.length} registros`,
      headers, rows,
      filename: `auditoria-${format(new Date(), "yyyy-MM-dd")}`,
      orientation: "landscape",
    });
    toast.success("PDF exportado!");
  };

  const exportExcel = () => {
    if (filteredLogs.length === 0) { toast.error("Nenhum registro para exportar"); return; }
    const headers = ["Data/Hora", "Usuário", "Ação", "Tipo", "Descrição", "Detalhes"];
    const rows = filteredLogs.map((l) => [
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      l.user_name || "Sistema",
      ACTION_LABELS[l.action] || l.action,
      ENTITY_LABELS[l.entity_type] || l.entity_type,
      buildDescription(l),
      JSON.stringify(l.details),
    ]);
    exportToExcel({
      title: "Painel de Auditoria",
      subtitle: `Total: ${filteredLogs.length} registros`,
      headers, rows,
      filename: `auditoria-${format(new Date(), "yyyy-MM-dd")}`,
    });
    toast.success("Excel exportado!");
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 sm:gap-6">
      <AdminPageHero icon={ShieldCheck} title="Painel de Auditoria" subtitle="Registro detalhado de todas as ações realizadas no sistema" />
      <div className="shrink-0 flex items-center justify-end flex-wrap gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os registros de auditoria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="checkout">Retiradas</SelectItem>
                <SelectItem value="checkin">Devoluções</SelectItem>
                <SelectItem value="user_registered">Cadastros</SelectItem>
                <SelectItem value="user_approved">Aprovações</SelectItem>
                <SelectItem value="delete">Exclusões</SelectItem>
                <SelectItem value="delete_history">Exclusão de Histórico</SelectItem>
                <SelectItem value="transfer">Transferências</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="tool">Ferramentas</SelectItem>
                <SelectItem value="vehicle">Veículos</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
                <SelectItem value="tool_checkout">Checkout Ferramenta</SelectItem>
                <SelectItem value="vehicle_checkout">Checkout Veículo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="text-base">Registros de Auditoria</CardTitle>
          <CardDescription>
            Mostrando {filteredLogs.length} de {logs.length} registros
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {filteredLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado
            </p>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className={`border-l-4 ${getActionColor(log.action)} hover:shadow-md transition-shadow`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      {getActionIcon(log.action, log.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={log.action.includes("delete") ? "destructive" : "default"} className="text-xs">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        </Badge>
                      </div>
                      <p className="text-sm">{buildDescription(log)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span className="font-medium">{log.user_name || "Sistema"}</span>
                        <span>•</span>
                        <span>{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-orange-500" />
                            Detalhes da Auditoria
                          </DialogTitle>
                        </DialogHeader>
                        {selectedLog && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Ação</p>
                                <Badge>{ACTION_LABELS[selectedLog.action] || selectedLog.action}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Tipo</p>
                                <Badge variant="outline">{ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Usuário</p>
                                <p className="text-sm font-medium">{selectedLog.user_name || "Sistema"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Data/Hora</p>
                                <p className="text-sm">{format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                              <p className="text-sm">{buildDescription(selectedLog)}</p>
                            </div>
                            {selectedLog.entity_id && (
                              <div>
                                <p className="text-xs text-muted-foreground">ID da Entidade</p>
                                <p className="text-xs font-mono bg-muted p-2 rounded">{selectedLog.entity_id}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Dados Completos</p>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60">
                                {JSON.stringify(selectedLog.details, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
