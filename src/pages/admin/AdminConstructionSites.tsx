import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Loader2, RefreshCw, Plus, Pencil, Trash2, Search, Building2, Wrench, ExternalLink, Car, Cog } from "lucide-react";
import { DeleteWithReasonDialog } from "@/components/DeleteWithReasonDialog";

interface ConstructionSite {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  created_at: string;
}


interface Tool {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  brand: string | null;
  condition: string;
  quantity_available: number;
  quantity_total: number;
  employee_only: boolean;
  active?: boolean;
}

export default function AdminConstructionSites() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "obras";

  // Site state
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null);
  const [savingSite, setSavingSite] = useState(false);
  const [siteFormName, setSiteFormName] = useState("");
  const [siteFormAddress, setSiteFormAddress] = useState("");


  // Tools state
  const [toolSearch, setToolSearch] = useState("");

  // Vehicles state
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    name: "", plate: "", brand: "", model: "", year: "", color: "",
    vehicle_type: "vehicle" as "vehicle" | "platform",
  });
  const [deleteVehicleOpen, setDeleteVehicleOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState<any>(null);


  // ─── Obras ───
  const { data: sites, isLoading: loadingSites } = useQuery({
    queryKey: ["construction-sites"],
    queryFn: async () => {
      return api.get<ConstructionSite[]>("/construction-sites");
    },
  });

  // Última sincronização (agendada ou manual), registrada em sync_state.
  const { data: syncState } = useQuery({
    queryKey: ["sync-state"],
    queryFn: () => api.get<Record<string, { last_run_at: string }>>("/sync/state"),
    refetchInterval: 60000,
  });
  const lastSiteSync = syncState?.["sync-trello"]?.last_run_at;
  const lastToolSync = syncState?.["sync-google-sheets"]?.last_run_at;

  const formatLastSync = (iso?: string) => {
    if (!iso) return "Nunca sincronizado";
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ summary: { added: number; reactivated: number; deactivated: number } }>("/sync/trello");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      queryClient.invalidateQueries({ queryKey: ["sync-state"] });
      toast.success(`Sincronização concluída! ${data.summary.added} novas, ${data.summary.reactivated} reativadas, ${data.summary.deactivated} removidas.`);
    },
    onError: (error: Error) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });




  // ─── Ferramentas ───
  const { data: tools = [], isLoading: loadingTools, refetch: refetchTools } = useQuery({
    queryKey: ["admin-tools"],
    queryFn: async () => {
      // Inclui ferramentas arquivadas (removidas da planilha mas com histórico).
      return api.get<Tool[]>("/tools", { include_archived: "true" });
    },
  });

  const syncToolsMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ summary: any }>("/sync/sheets");
    },
    onSuccess: (data) => {
      const s = data.summary;
      const errs: string[] = s.errors || [];
      const baseDesc = `${s.added} adicionada(s), ${s.updated} atualizada(s), ${s.deleted} removida(s), ${s.archived ?? 0} arquivada(s) de ${s.total_sheet_rows} linhas.`;
      if (errs.length > 0) {
        toast.warning("Sincronização concluída com avisos", {
          description: `${baseDesc}\n${errs.length} item(ns) com erro: ${errs.slice(0, 3).join("; ")}${errs.length > 3 ? "…" : ""}`,
          duration: 10000,
        });
      } else {
        toast.success("Sincronização concluída!", { description: baseDesc });
      }
      refetchTools();
      queryClient.invalidateQueries({ queryKey: ["sync-state"] });
    },
    onError: (error: Error) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });

  // ─── Veículos ───
  const { data: vehicles = [], isLoading: loadingVehicles, refetch: refetchVehicles } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: async () => {
      return api.get<any[]>("/vehicles");
    },
  });

  const filteredVehicles = vehicles.filter((v: any) =>
    !vehicleSearch ||
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.plate?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.brand?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.model?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const resetVehicleForm = () => {
    setEditingVehicleId(null);
    setVehicleForm({ name: "", plate: "", brand: "", model: "", year: "", color: "", vehicle_type: "vehicle" });
  };

  const openNewVehicle = () => {
    resetVehicleForm();
    setVehicleDialogOpen(true);
  };

  const openEditVehicle = (v: any) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      name: v.name,
      plate: v.plate,
      brand: v.brand || "",
      model: v.model || "",
      year: v.year?.toString() || "",
      color: v.color || "",
      vehicle_type: (v.vehicle_type as "vehicle" | "platform") || "vehicle",
    });
    setVehicleDialogOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      const payload = {
        name: vehicleForm.name,
        plate: vehicleForm.plate.toUpperCase(),
        brand: vehicleForm.brand || null,
        model: vehicleForm.model || null,
        year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
        color: vehicleForm.color || null,
        vehicle_type: vehicleForm.vehicle_type,
      };
      if (editingVehicleId) {
        await api.patch(`/vehicles/${editingVehicleId}`, payload);
        toast.success("Veículo atualizado!");
      } else {
        await api.post("/vehicles", payload);
        toast.success("Veículo cadastrado!");
      }
      setVehicleDialogOpen(false);
      resetVehicleForm();
      refetchVehicles();
      queryClient.invalidateQueries({ queryKey: ["vehicles-list-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-stats"] });
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleDeleteVehicleConfirm = async (reason: string) => {
    if (!deletingVehicle) return;
    try {
      // O motivo fica registrado na auditoria pelo servidor.
      await api.delete(`/vehicles/${deletingVehicle.id}`, { reason });
      toast.success("Veículo excluído!");
      refetchVehicles();
      queryClient.invalidateQueries({ queryKey: ["vehicles-list-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-stats"] });
    } catch (err: any) {
      toast.error("Erro ao excluir", { description: err.message });
    }
  };

  const openEditSite = (site: ConstructionSite) => {
    setEditingSite(site);
    setSiteFormName(site.name);
    setSiteFormAddress(site.address || "");
    setSiteDialogOpen(true);
  };

  const handleSaveSite = async () => {
    if (!editingSite) return;
    if (!siteFormName.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingSite(true);

    try {
      await api.patch(`/construction-sites/${editingSite.id}`, {
        name: siteFormName.trim(),
        address: siteFormAddress.trim() || null,
      });
      toast.success("Obra atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      setSiteDialogOpen(false);
    } catch {
      toast.error("Erro ao atualizar obra");
    }
    setSavingSite(false);
  };


  const filteredTools = tools.filter((tool) =>
    !toolSearch || 
    tool.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
    tool.tag?.toLowerCase().includes(toolSearch.toLowerCase()) ||
    tool.brand?.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const getConditionLabel = (condition: string) => {
    const map: Record<string, string> = {
      excellent: "Excelente",
      good: "Bom",
      fair: "Regular",
      poor: "Ruim",
      needs_maintenance: "Manutenção",
    };
    return map[condition] || condition;
  };

  const getConditionClass = (condition: string) => {
    const map: Record<string, string> = {
      excellent: "bg-success text-success-foreground",
      good: "bg-primary text-primary-foreground",
      fair: "bg-warning text-warning-foreground",
      poor: "bg-warning text-warning-foreground",
      needs_maintenance: "bg-destructive text-destructive-foreground",
    };
    return map[condition] || "bg-destructive text-destructive-foreground";
  };

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHero icon={Building2} title="Gestão Administrativa" subtitle="Gerencie obras e inventário de ferramentas" />

      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="obras" className="gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">Obras</span>
          </TabsTrigger>
          <TabsTrigger value="ferramentas" className="gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">Ferramentas</span>
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm">
            <Car className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">Veículos</span>
          </TabsTrigger>
        </TabsList>


        {/* ─── ABA OBRAS ─── */}
        <TabsContent value="obras" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="w-5 h-5 text-primary" />
                  Obras Cadastradas
                </CardTitle>
                <CardDescription className="text-xs">
                  {sites?.length || 0} obras no sistema · Última sincronização:{" "}
                  <span className="font-medium text-foreground">{formatLastSync(lastSiteSync)}</span>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full sm:w-auto shrink-0"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                Sincronizar Trello
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSites ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !sites || sites.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma obra cadastrada</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 sm:hidden">
                    {sites.map((site) => (
                      <div key={site.id} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{site.name}</p>
                            {site.address && <p className="text-xs text-muted-foreground truncate">{site.address}</p>}
                          </div>
                          <Badge variant={site.active ? "default" : "secondary"} className="shrink-0 text-[10px]">
                            {site.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditSite(site)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead className="hidden md:table-cell">Endereço</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sites.map((site) => (
                          <TableRow key={site.id}>
                            <TableCell className="font-medium">{site.name}</TableCell>
                            <TableCell className="hidden md:table-cell">{site.address || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={site.active ? "default" : "secondary"}>
                                {site.active ? "Ativa" : "Inativa"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditSite(site)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}

                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>




        {/* ─── ABA FERRAMENTAS ─── */}
        <TabsContent value="ferramentas" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="w-5 h-5 text-primary" />
                    Inventário de Ferramentas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tools.length} ferramentas catalogadas · Última sincronização:{" "}
                    <span className="font-medium text-foreground">{formatLastSync(lastToolSync)}</span>
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full sm:w-auto shrink-0"
                  disabled={syncToolsMutation.isPending}
                  onClick={() => syncToolsMutation.mutate()}
                >
                  <RefreshCw className={`w-4 h-4 ${syncToolsMutation.isPending ? "animate-spin" : ""}`} />
                  Sincronizar Planilha
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ferramenta, TAG ou marca..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingTools ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredTools.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma ferramenta encontrada</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 sm:hidden">
                    {filteredTools.map((tool) => (
                      <div key={tool.id} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{tool.name} {tool.active === false && <Badge variant="secondary" className="ml-1 text-[10px]">Arquivada</Badge>}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {[tool.brand, tool.tag].filter(Boolean).join(" · ") || "-"}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={() => navigate(`/ferramentas/${tool.id}`)}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {tool.quantity_available}/{tool.quantity_total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>TAG</TableHead>
                          <TableHead className="hidden md:table-cell">Marca</TableHead>
                          
                          <TableHead className="hidden lg:table-cell">Qtd. Disp/Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTools.map((tool) => (
                          <TableRow key={tool.id}>
                            <TableCell className="font-medium">{tool.name} {tool.active === false && <Badge variant="secondary" className="ml-1 text-[10px]">Arquivada</Badge>}</TableCell>
                            <TableCell>{tool.tag || "-"}</TableCell>
                            <TableCell className="hidden md:table-cell">{tool.brand || "-"}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {tool.quantity_available}/{tool.quantity_total}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/ferramentas/${tool.id}`)}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA VEÍCULOS ─── */}
        <TabsContent value="veiculos" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Car className="w-5 h-5 text-primary" />
                    Inventário de Veículos
                  </CardTitle>
                  <CardDescription className="text-xs">{vehicles.length} veículos cadastrados</CardDescription>
                </div>
                <Button onClick={openNewVehicle} size="sm" className="gap-2 w-full sm:w-auto shrink-0">
                  <Plus className="w-4 h-4" /> Novo Veículo
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, placa, marca ou modelo..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingVehicles ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredVehicles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum veículo encontrado</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 sm:hidden">
                    {filteredVehicles.map((v: any) => (
                      <div key={v.id} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{v.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{v.plate}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditVehicle(v)} aria-label="Editar veículo">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setDeletingVehicle(v); setDeleteVehicleOpen(true); }} aria-label="Excluir veículo">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {[v.brand, v.model].filter(Boolean).join(" ") || "-"}
                          </span>
                          <div className="flex gap-1.5">
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              {v.vehicle_type === "platform" ? <Cog className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                              {v.vehicle_type === "platform" ? "Plataforma" : "Veículo"}
                            </Badge>
                            <Badge variant={v.status === "available" ? "default" : "secondary"} className="text-[10px]">
                              {v.status === "available" ? "Disponível" : "Em uso"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead className="hidden md:table-cell">Marca/Modelo</TableHead>
                          <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVehicles.map((v: any) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{v.name}</TableCell>
                            <TableCell className="font-mono text-xs">{v.plate}</TableCell>
                            <TableCell className="hidden md:table-cell">{[v.brand, v.model].filter(Boolean).join(" ") || "-"}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="outline" className="gap-1">
                                {v.vehicle_type === "platform" ? <Cog className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                                {v.vehicle_type === "platform" ? "Plataforma" : "Veículo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={v.status === "available" ? "default" : "secondary"}>
                                {v.status === "available" ? "Disponível" : "Em uso"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditVehicle(v)} aria-label="Editar veículo">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setDeletingVehicle(v); setDeleteVehicleOpen(true); }} aria-label="Excluir veículo">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Obra */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={siteFormName} onChange={(e) => setSiteFormName(e.target.value)} placeholder="Nome da obra" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={siteFormAddress} onChange={(e) => setSiteFormAddress(e.target.value)} placeholder="Endereço da obra" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSite} disabled={savingSite}>
              {savingSite && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog de Veículo */}
      <Dialog open={vehicleDialogOpen} onOpenChange={(open) => { setVehicleDialogOpen(open); if (!open) resetVehicleForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVehicleId ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveVehicle} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={vehicleForm.vehicle_type} onValueChange={(v: "vehicle" | "platform") => setVehicleForm({ ...vehicleForm, vehicle_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                  <SelectItem value="platform">Plataforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{vehicleForm.vehicle_type === "platform" ? "Identificação *" : "Placa *"}</Label>
                <Input value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingVehicle}>
                {savingVehicle && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingVehicleId ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteWithReasonDialog
        open={deleteVehicleOpen}
        onOpenChange={setDeleteVehicleOpen}
        onConfirm={handleDeleteVehicleConfirm}
        title="Excluir Veículo"
        description="Esta ação não pode ser desfeita. Informe o motivo para registro de auditoria."
        itemName={deletingVehicle ? `${deletingVehicle.name} (${deletingVehicle.plate})` : ""}
      />

    </div>
  );
}
