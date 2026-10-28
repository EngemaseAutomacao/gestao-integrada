import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Wrench, Car, User, LogIn, LogOut, ShieldAlert, FileDown, FileSpreadsheet, ScrollText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HistorySkeleton } from "@/components/PageSkeleton";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";

interface SystemLog {
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
  manual_checkout_by_admin: "Retirada Manual (Admin)",
  manual_checkin_by_admin: "Devolução Manual (Admin)",
  user_registered: "Novo Cadastro",
  user_approved: "Usuário Aprovado",
};

const MANUAL_ACTIONS = new Set(["manual_checkout_by_admin", "manual_checkin_by_admin"]);

const ENTITY_LABELS: Record<string, string> = {
  tool: "Ferramenta",
  vehicle: "Veículo",
  user: "Usuário",
};

function getActionIcon(action: string, entityType: string) {
  if (entityType === "vehicle") return <Car className="w-4 h-4" />;
  if (entityType === "user") return <User className="w-4 h-4" />;
  if (action === "checkout") return <LogOut className="w-4 h-4" />;
  if (action === "checkin") return <LogIn className="w-4 h-4" />;
  return <Wrench className="w-4 h-4" />;
}

function getActionColor(action: string): string {
  switch (action) {
    case "checkout": return "border-l-orange-500";
    case "checkin": return "border-l-green-500";
    case "manual_checkout_by_admin": return "border-l-amber-500";
    case "manual_checkin_by_admin": return "border-l-amber-500";
    case "user_registered": return "border-l-blue-500";
    case "user_approved": return "border-l-emerald-500";
    default: return "border-l-primary";
  }
}

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  switch (action) {
    case "checkout": return "default";
    case "checkin": return "secondary";
    default: return "outline";
  }
}

function buildDescription(log: SystemLog): string {
  const d = log.details || {};
  const entityName = log.entity_type === "tool" ? `ferramenta "${d.tool_name || ""}"`
                   : log.entity_type === "vehicle" ? `veículo "${d.vehicle_name || ""} (${d.plate || ""})"`
                   : "item";
  const respSuffix = d.responsible_user_name ? ` em nome de ${d.responsible_user_name}` : "";

  switch (log.action) {
    case "checkout":
      if (log.entity_type === "tool")
        return `Retirou a ${entityName}${d.construction_site ? ` para ${d.construction_site}` : ""}${d.selected_tag ? ` (TAG: ${d.selected_tag})` : ""}`;
      if (log.entity_type === "vehicle")
        return `Retirou o ${entityName}${d.destination ? ` - Destino: ${d.destination}` : ""}`;
      return "";
    case "checkin":
      return `Devolveu a ${entityName}`;
    case "manual_checkout_by_admin":
      return `Retirou manualmente a ${entityName}${respSuffix}${d.construction_site ? ` para ${d.construction_site}` : ""}${d.destination ? ` - Destino: ${d.destination}` : ""}`;
    case "manual_checkin_by_admin":
      return `Devolveu manualmente a ${entityName}${respSuffix}`;
    case "user_registered":
      return `Novo usuário registrado: ${d.email || ""} (${d.category === "engemase_employee" ? "Funcionário" : d.category === "third_party" ? "Terceirizado" : "Sócio"})`;
    case "user_approved":
      return `Aprovou o usuário "${d.approved_user || ""}" (${d.email || ""})`;
    default:
      return JSON.stringify(d);
  }
}

export default function AdminLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
  }, []);


  const loadLogs = async () => {
    try {
      setLogs(await api.get<SystemLog[]>("/logs", { limit: 500 }));
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (filterAction === "manual_only") {
      if (!MANUAL_ACTIONS.has(log.action)) return false;
    } else if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterEntity !== "all" && log.entity_type !== filterEntity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const desc = buildDescription(log).toLowerCase();
      const name = (log.user_name || "").toLowerCase();
      return desc.includes(q) || name.includes(q);
    }
    return true;
  }), [logs, filterAction, filterEntity, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 110,
    overscan: 8,
  });

  const buildExportRows = () =>
    filteredLogs.map((l) => [
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ACTION_LABELS[l.action] || l.action,
      ENTITY_LABELS[l.entity_type] || l.entity_type,
      l.user_name || "Sistema",
      buildDescription(l),
    ]);

  const handleExportPDF = async () => {
    try {
      await exportToPDF({
        title: "Logs do Sistema",
        subtitle: `${filteredLogs.length} registro(s)`,
        headers: ["Data/Hora", "Ação", "Tipo", "Usuário", "Descrição"],
        rows: buildExportRows(),
        filename: "logs-sistema",
        orientation: "landscape",
        generatedBy: profile?.full_name,
      });
      toast.success("PDF gerado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel({
        title: "Logs do Sistema",
        subtitle: `${filteredLogs.length} registro(s)`,
        headers: ["Data/Hora", "Ação", "Tipo", "Usuário", "Descrição"],
        rows: buildExportRows(),
        filename: "logs-sistema",
        generatedBy: profile?.full_name,
      });
      toast.success("Planilha gerada com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar planilha");
    }
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }
  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      <AdminPageHero icon={ScrollText} title="Logs do Sistema" subtitle="Histórico completo de ações no sistema" />

      <Card className="shrink-0">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="flex-1 min-w-[180px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="manual_only">⚠️ Apenas Ações Manuais (Admin)</SelectItem>
                <SelectItem value="checkout">Retiradas</SelectItem>
                <SelectItem value="checkin">Devoluções</SelectItem>
                <SelectItem value="manual_checkout_by_admin">Retirada Manual (Admin)</SelectItem>
                <SelectItem value="manual_checkin_by_admin">Devolução Manual (Admin)</SelectItem>
                <SelectItem value="user_registered">Cadastros</SelectItem>
                <SelectItem value="user_approved">Aprovações</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="flex-1 min-w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="tool">Ferramentas</SelectItem>
                <SelectItem value="vehicle">Veículos</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredLogs.length === 0} className="gap-1.5">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredLogs.length === 0} className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="text-base">Registros de Atividade</CardTitle>
          <CardDescription>
            Mostrando {filteredLogs.length} de {logs.length} registros
          </CardDescription>
        </CardHeader>
        <CardContent ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado
            </p>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const log = filteredLogs[virtualRow.index];
                return (
                  <div
                    key={log.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: 8,
                    }}
                  >
                    <Card className={`border-l-4 ${getActionColor(log.action)}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-muted-foreground">
                            {getActionIcon(log.action, log.entity_type)}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getActionBadgeVariant(log.action)} className="text-xs">
                                {ACTION_LABELS[log.action] || log.action}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {ENTITY_LABELS[log.entity_type] || log.entity_type}
                              </Badge>
                              {MANUAL_ACTIONS.has(log.action) && (
                                <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500/90 gap-1">
                                  <ShieldAlert className="w-3 h-3" /> Manual
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{buildDescription(log)}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{log.user_name || "Sistema"}</span>
                              <span>•</span>
                              <span>{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
