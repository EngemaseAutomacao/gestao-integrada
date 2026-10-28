import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { useActiveConstructionSites } from "@/hooks/useConstructionSites";
import { Card, CardContent } from "@/components/ui/card";
import { ModuleHero } from "@/components/ModuleHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ConstructionSiteAutocomplete } from "@/components/ConstructionSiteAutocomplete";
import { toast } from "sonner";
import { Loader2, CheckSquare, X } from "lucide-react";
import { vibrate, VibrationPatterns, shareContent, scheduleLocalReminder } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

interface Tool {
  id: string;
  name: string;
  description: string | null;
  quantity_available: number;
  employee_only: boolean;
  tag: string | null;
}

interface BulkSelection {
  selectedTag?: string;
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { isOnline, addPendingOperation } = useOffline();
  const { data: cachedTools, saveToCache } = useOfflineStorage<Tool[]>("tools", []);
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>(cachedTools || []);
  const toolIdFromParam = searchParams.get("toolId") || "";
  const [selectedToolId, setSelectedToolId] = useState<string>(toolIdFromParam);
  const isToolLocked = !!toolIdFromParam;
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [constructionSite, setConstructionSite] = useState("");
  const [estimatedReturnDate, setEstimatedReturnDate] = useState("");
  const [returnDays, setReturnDays] = useState<string>("");
  const handleReturnDaysChange = (value: string) => {
    setReturnDays(value);
    const days = parseInt(value, 10);
    if (!Number.isNaN(days)) {
      const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      setEstimatedReturnDate(d.toISOString());
    } else {
      setEstimatedReturnDate("");
    }
  };

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTools, setLoadingTools] = useState(true);

  // Admin: responsible user (defaults to self)
  const [responsibleUserId, setResponsibleUserId] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [manualDate, setManualDate] = useState<string>("");
  const [approvedUsers, setApprovedUsers] = useState<{ id: string; full_name: string }[]>([]);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(searchParams.get("bulk") === "1");
  const [bulkSelections, setBulkSelections] = useState<Map<string, BulkSelection>>(new Map());
  const [bulkActiveTags, setBulkActiveTags] = useState<Record<string, string[]>>({});
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSelectionConfirmed, setBulkSelectionConfirmed] = useState(false);
  const [preBulkToolId, setPreBulkToolId] = useState<string>("");
  const [preBulkTag, setPreBulkTag] = useState<string>("");
  const [tagError, setTagError] = useState("");

  // Tool condition at checkout
  const [toolCondition, setToolCondition] = useState<string>("");


  const selectedTool = tools.find(t => t.id === selectedToolId);
  const allToolTags = selectedTool?.tag ? selectedTool.tag.split(",").map(t => t.trim()).filter(Boolean) : [];
  const toolTags = allToolTags.filter(t => !activeTags.includes(t));
  const hasMultipleTags = allToolTags.length > 1;

  const { data: constructionSites } = useActiveConstructionSites();

  const hasUnsavedData = !!(constructionSite || notes || estimatedReturnDate || toolCondition || bulkSelections.size > 0);
  useUnsavedChanges(hasUnsavedData);

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    if (!isAdmin || !isOnline) return;
    (async () => {
      try {
        const data = await api.get<{ id: string; full_name: string }[]>("/users/approved");
        setApprovedUsers(data);
      } catch {
        // seletor fica vazio; o admin ainda pode retirar em nome próprio
      }
    })();
  }, [isAdmin, isOnline]);

  // Carrega TAGs já retiradas (modo único)
  useEffect(() => {
    if (!selectedToolId || !isOnline || bulkMode) {
      setActiveTags([]);
      return;
    }
    (async () => {
      try {
        const data = await api.get<{ tool_id: string; selected_tag: string | null }[]>(
          "/tool-checkouts/active-tags",
          { tool_ids: selectedToolId },
        );
        setActiveTags(data.map((r) => (r.selected_tag || "").trim()).filter(Boolean));
      } catch {
        setActiveTags([]);
      }
    })();
  }, [selectedToolId, isOnline, bulkMode]);

  // Carrega TAGs já retiradas para todas as ferramentas com múltiplas tags (modo bulk)
  useEffect(() => {
    if (!bulkMode || !isOnline) return;
    const multiTagToolIds = tools.filter(t => (t.tag || "").split(",").map(s => s.trim()).filter(Boolean).length > 1).map(t => t.id);
    if (multiTagToolIds.length === 0) return;
    (async () => {
      let data: { tool_id: string; selected_tag: string | null }[];
      try {
        data = await api.get("/tool-checkouts/active-tags", { tool_ids: multiTagToolIds.join(",") });
      } catch {
        return;
      }
      const map: Record<string, string[]> = {};
      data.forEach((r) => {
        const t = (r.selected_tag || "").trim();
        if (!t) return;
        map[r.tool_id] = [...(map[r.tool_id] || []), t];
      });
      setBulkActiveTags(map);
    })();
  }, [bulkMode, isOnline, tools]);

  const loadTools = async () => {
    try {
      if (!isOnline) {
        if (cachedTools && cachedTools.length > 0) {
          setTools(cachedTools);
          toast.info("Modo offline - usando dados em cache");
        } else {
          toast.warning("Nenhum dado em cache disponível");
        }
        setLoadingTools(false);
        return;
      }
      // O servidor já filtra as ferramentas exclusivas de funcionários para terceiros.
      const filteredTools = await api.get<Tool[]>("/tools", { available: "true" });
      setTools(filteredTools);
      saveToCache(filteredTools);
    } catch (error: any) {
      toast.error("Erro ao carregar ferramentas", { description: error.message });
    } finally {
      setLoadingTools(false);
    }
  };

  // Pre-select tools coming from URL (?toolIds=a,b,c&tags=a:TAG1,b:TAG2) in bulk mode
  useEffect(() => {
    const ids = (searchParams.get("toolIds") || "").split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      const tagMap = new Map<string, string>();
      (searchParams.get("tags") || "").split(",").forEach(pair => {
        const [id, tag] = pair.split(":");
        if (id && tag) tagMap.set(id.trim(), decodeURIComponent(tag));
      });
      setBulkMode(true);
      setBulkSelections(new Map(ids.map(id => {
        const t = tagMap.get(id);
        return [id, t ? { selectedTag: t } : {}];
      })));
    }
  }, [searchParams]);


  // Bulk helpers
  const toggleBulkTool = (toolId: string) => {
    setBulkSelections(prev => {
      const next = new Map(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.set(toolId, {});
      return next;
    });
  };

  const setBulkToolTag = (toolId: string, tag: string) => {
    setBulkSelections(prev => {
      const next = new Map(prev);
      next.set(toolId, { selectedTag: tag });
      return next;
    });
  };

  const filteredTools = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(t => t.name.toLowerCase().includes(q) || (t.tag || "").toLowerCase().includes(q));
  }, [tools, bulkSearch]);

  const enterBulkMode = () => {
    setPreBulkToolId(selectedToolId);
    setPreBulkTag(selectedTag);
    setBulkMode(true);
    setSelectedToolId("");
    setSelectedTag("");
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setBulkSelections(new Map());
    setBulkSearch("");
    setBulkSelectionConfirmed(false);
    setSelectedToolId(preBulkToolId);
    setSelectedTag(preBulkTag);
    setPreBulkToolId("");
    setPreBulkTag("");
  };


  const handleBulkCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSelections.size === 0) { toast.error("Selecione ao menos uma ferramenta"); return; }
    const finalSite = constructionSite.trim();
    if (!finalSite) { toast.error("Informe a obra de destino"); return; }
    if (!estimatedReturnDate) { toast.error("Informe a data estimada de devolução"); return; }

    // Validate multi-tag tools
    setTagError("");
    for (const [toolId, sel] of bulkSelections) {
      const tool = tools.find(t => t.id === toolId);
      if (!tool) continue;
      const tags = (tool.tag || "").split(",").map(s => s.trim()).filter(Boolean);
      if (tags.length > 1) {
        if (!sel.selectedTag) {
          const msg = `Selecione a TAG da ferramenta "${tool.name}" antes de confirmar.`;
          setTagError(msg);
          toast.error(msg);
          return;
        }
        if ((bulkActiveTags[toolId] || []).includes(sel.selectedTag)) {
          const msg = `A TAG ${sel.selectedTag} de "${tool.name}" já está em uso.`;
          setTagError(msg);
          toast.error(msg);
          return;
        }
      }
    }

    const isAdminActingForOther = isAdmin && !!responsibleUserId && responsibleUserId !== profile!.id;
    if (isAdminActingForOther && notes.trim().length < 5) {
      toast.error("Justificativa obrigatória", { description: "Informe uma observação (mín. 5 caracteres) ao retirar em nome de outro usuário." });
      return;
    }

    setLoading(true);

    try {
      const conditionPrefix = toolCondition ? `[Estado: ${toolCondition}]` : "";
      const finalNotes = [conditionPrefix, notes.trim()].filter(Boolean).join(" ") || null;

      const effectiveUserId = isAdmin && responsibleUserId ? responsibleUserId : profile!.id;
      const rows = Array.from(bulkSelections.entries()).map(([toolId, sel]) => {
        const tool = tools.find(t => t.id === toolId)!;
        const tags = (tool.tag || "").split(",").map(s => s.trim()).filter(Boolean);
        return {
          tool_id: toolId,
          user_id: effectiveUserId,
          checked_out_by: profile!.id,
          status: "checked_out" as const,
          construction_site: finalSite,
          estimated_return_date: new Date(estimatedReturnDate).toISOString(),
          notes: finalNotes,
          checkout_photo_url: null,
          selected_tag: tags.length > 1 ? (sel.selectedTag || null) : (tags.length === 1 ? tags[0] : null),
        };

      });

      if (!isOnline) {
        rows.forEach(r => addPendingOperation("checkout", r));
        vibrate(VibrationPatterns.success);
        toast.success(`${rows.length} ferramenta(s) retirada(s) (offline)! Sincronizando ao conectar.`);
        navigate("/ferramentas");
        return;
      }

      await api.post("/tool-checkouts", { items: rows });
      vibrate(VibrationPatterns.success);
      toast.success(`${rows.length} ferramenta(s) retirada(s) com sucesso!`);
      // Agenda lembrete local 1h antes da devolução estimada
      const due = new Date(estimatedReturnDate).getTime();
      if (due) {
        scheduleLocalReminder({
          title: "Lembrete de devolução",
          body: `${rows.length} ferramenta(s) com devolução prevista para hoje.`,
          showAt: due - 60 * 60 * 1000,
          tag: "tool-return-reminder",
        });
      }
      navigate("/ferramentas");
    } catch (error: any) {
      toast.error("Erro ao retirar ferramentas", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToolId) { toast.error("Selecione uma ferramenta"); return; }
    setTagError("");
    if (hasMultipleTags && !selectedTag) {
      const msg = "Selecione qual TAG você está retirando antes de confirmar.";
      setTagError(msg);
      toast.error(msg);
      return;
    }
    if (selectedTag && activeTags.includes(selectedTag)) {
      const msg = "Esta TAG já está em uso. Selecione outra ou aguarde a devolução.";
      setTagError(msg);
      toast.error(msg);
      return;
    }
    const finalSite = constructionSite.trim();
    if (!finalSite) { toast.error("Informe a obra de destino"); return; }
    if (!estimatedReturnDate) { toast.error("Informe a data estimada de devolução"); return; }

    const isAdminActingForOther = isAdmin && !!responsibleUserId && responsibleUserId !== profile!.id;
    if (isAdminActingForOther && notes.trim().length < 5) {
      toast.error("Justificativa obrigatória", { description: "Informe uma observação (mín. 5 caracteres) ao retirar em nome de outro usuário." });
      return;
    }

    setLoading(true);

    try {
      const conditionPrefix = toolCondition ? `[Estado: ${toolCondition}]` : "";
      const finalNotes = [conditionPrefix, notes.trim()].filter(Boolean).join(" ") || null;

      const checkoutData = {
        tool_id: selectedToolId,
        user_id: isAdmin && responsibleUserId ? responsibleUserId : profile!.id,
        checked_out_by: profile!.id,
        status: "checked_out" as const,
        construction_site: finalSite,
        estimated_return_date: new Date(estimatedReturnDate).toISOString(),
        notes: finalNotes,
        checkout_photo_url: null,
        selected_tag: hasMultipleTags ? selectedTag : (toolTags.length === 1 ? toolTags[0] : null),
        ...(isAdmin && manualMode && manualDate ? { checkout_date: new Date(manualDate).toISOString() } : {}),
      };


      if (!isOnline) {
        addPendingOperation("checkout", checkoutData);
        vibrate(VibrationPatterns.success);
        toast.success("Ferramenta retirada (offline)! Será sincronizada quando conectar.");
        navigate("/ferramentas");
        return;
      }

      await api.post("/tool-checkouts", checkoutData);
      vibrate(VibrationPatterns.success);
      toast.success("Ferramenta retirada com sucesso!", {
        action: {
          label: "Compartilhar",
          onClick: () =>
            shareContent({
              title: "Retirada de ferramenta",
              text: `Retirei uma ferramenta para a obra "${finalSite}". Devolução prevista: ${new Date(estimatedReturnDate).toLocaleDateString("pt-BR")}.`,
            }),
        },
      });
      const due = new Date(estimatedReturnDate).getTime();
      if (due) {
        scheduleLocalReminder({
          title: "Lembrete de devolução",
          body: `Ferramenta com devolução prevista para hoje.`,
          showAt: due - 60 * 60 * 1000,
          tag: `tool-return-${selectedToolId}`,
        });
      }
      navigate("/ferramentas");
    } catch (error: any) {
      toast.error("Erro ao retirar ferramenta", { description: error.message });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="h-full flex flex-col space-y-3 min-h-0 overflow-hidden">
      <div className="shrink-0 -mx-3 sm:-mx-4 md:-mx-6">
        <ModuleHero
          narrow
          compact
          inline
          eyebrow="Módulo · Ferramentas"
          title="Registrar Saída"
          subtitle={bulkMode ? "Selecione várias ferramentas para retirar de uma vez" : "Registre a saída de uma ferramenta"}
        />
      </div>


      <div className="max-w-4xl w-full mx-auto flex-1 min-h-0 overflow-auto space-y-3">
      <Card>

        <CardContent className="p-4 sm:p-5">
          {isAdmin && (

            <div className="space-y-2 mb-4 p-2 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="manual_mode_tool" className="cursor-pointer">Retirada manual (em nome de outro)</Label>
                <Switch
                  id="manual_mode_tool"
                  checked={manualMode}
                  onCheckedChange={(v) => {
                    setManualMode(v);
                    if (!v) { setResponsibleUserId(""); setManualDate(""); }
                  }}
                />
              </div>
              {manualMode && (
                <>
                  <Label htmlFor="responsible_user">Responsável pela retirada</Label>
                  <Select value={responsibleUserId || profile!.id} onValueChange={(v) => setResponsibleUserId(v === profile!.id ? "" : v)}>
                    <SelectTrigger id="responsible_user">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={profile!.id}>Eu mesmo ({profile!.full_name})</SelectItem>
                      {approvedUsers.filter(u => u.id !== profile!.id).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">A ferramenta ficará vinculada a este usuário, que poderá devolvê-la.</p>
                  <Label htmlFor="manual_date_tool">Data e hora da retirada (retroativa, opcional)</Label>
                  <Input
                    id="manual_date_tool"
                    type="datetime-local"
                    value={manualDate}
                    max={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para usar a data/hora atual.</p>
                  {responsibleUserId && responsibleUserId !== profile!.id && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 p-2 rounded text-xs">
                      <strong>Retirada manual:</strong> ação será registrada como "manual_checkout_by_admin". Justificativa obrigatória no campo Observações (mín. 5 caracteres).
                    </div>
                  )}
                </>
              )}
            </div>
          )}


          {bulkMode ? (
            <form onSubmit={handleBulkCheckout} className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center justify-between gap-2">
                  <span>Ferramentas * ({bulkSelections.size} selecionada{bulkSelections.size === 1 ? "" : "s"})</span>
                  <div className="flex gap-2">
                    {bulkSelectionConfirmed && (
                      <Button type="button" variant="outline" size="sm" className="gap-1 h-7" onClick={() => setBulkSelectionConfirmed(false)}>
                        Editar
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" className="gap-1 h-7" onClick={exitBulkMode}>
                      <X className="w-3.5 h-3.5" /> Sair
                    </Button>
                  </div>
                </Label>

                {!bulkSelectionConfirmed && (
                  <Input
                    placeholder="Buscar por nome ou TAG..."
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                  />
                )}
                <div className="border rounded-md divide-y max-h-[114px] overflow-y-auto">
                  {(() => {
                    const list = bulkSelectionConfirmed
                      ? tools.filter(t => bulkSelections.has(t.id))
                      : filteredTools;
                    if (list.length === 0) {
                      return <p className="text-sm text-muted-foreground p-3">Nenhuma ferramenta {bulkSelectionConfirmed ? "selecionada" : "encontrada"}.</p>;
                    }
                    return list.map((tool) => {
                      const isSelected = bulkSelections.has(tool.id);
                      const tags = (tool.tag || "").split(",").map(s => s.trim()).filter(Boolean);
                      const activeForTool = bulkActiveTags[tool.id] || [];
                      const availableTags = tags.filter(t => !activeForTool.includes(t));
                      const sel = bulkSelections.get(tool.id);
                      return (
                        <div key={tool.id} className="flex flex-col gap-2 p-2 sm:p-3 hover:bg-muted/40">
                          <label className={cn("flex items-start gap-3", !bulkSelectionConfirmed && "cursor-pointer")}>
                            {!bulkSelectionConfirmed && (
                              <Checkbox checked={isSelected} onCheckedChange={() => toggleBulkTool(tool.id)} className="mt-1" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Disponível: {tool.quantity_available}
                                {tags.length > 0 && ` · TAGs: ${tags.join(", ")}`}
                              </p>
                            </div>
                          </label>
                          {isSelected && tags.length > 1 && (
                            <div className={bulkSelectionConfirmed ? "" : "pl-8"}>
                              <Select
                                value={sel?.selectedTag || ""}
                                onValueChange={(v) => setBulkToolTag(tool.id, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder={availableTags.length === 0 ? "Todas as TAGs em uso" : "Selecione a TAG"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTags.map((t) => (
                                    <SelectItem key={t} value={t}>TAG {t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                {!bulkSelectionConfirmed && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={bulkSelections.size === 0}
                    onClick={() => setBulkSelectionConfirmed(true)}
                  >
                    Confirmar Seleção

                  </Button>
                )}
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="construction_site_bulk">Obra de Destino *</Label>
                  <ConstructionSiteAutocomplete
                    sites={constructionSites || []}
                    value={constructionSite}
                    onChange={setConstructionSite}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimated_return_bulk">Previsão de Devolução *</Label>
                  <Select value={returnDays} onValueChange={handleReturnDaysChange}>
                    <SelectTrigger id="estimated_return_bulk">
                      <SelectValue placeholder="Selecione o prazo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Dia</SelectItem>
                      <SelectItem value="7">7 Dias</SelectItem>
                      <SelectItem value="15">15 Dias</SelectItem>
                      <SelectItem value="30">30 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>


              <div className="space-y-2">
                <Label htmlFor="notes_bulk">Observações (opcional)</Label>
                <Textarea
                  id="notes_bulk"
                  placeholder="Observação aplicada a todas as retiradas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  className="min-h-9 resize-none overflow-hidden"
                />

              </div>



              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className={cn("text-sm font-medium", tagError ? "text-destructive" : "sr-only")}
              >
                {tagError}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading || bulkSelections.size === 0 || !constructionSite.trim() || !estimatedReturnDate} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Saída
                </Button>
                <Button type="button" variant="outline" onClick={exitBulkMode}>Cancelar</Button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tool" className="flex items-center justify-between gap-2">
                  <span>Ferramenta *</span>
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7" onClick={enterBulkMode}>
                    <CheckSquare className="w-3.5 h-3.5" /> Retirada em Lote
                  </Button>
                </Label>

                <Select
                  key={selectedToolId || "empty"}
                  value={selectedToolId}
                  onValueChange={(val) => { setSelectedToolId(val); setSelectedTag(""); }}
                  disabled={loadingTools || isToolLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma ferramenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {tools.map((tool) => (
                      <SelectItem key={tool.id} value={tool.id}>
                        {tool.name} (Disponível: {tool.quantity_available})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedToolId && hasMultipleTags ? (
                <div className="space-y-2">
                  <Label>Selecione a TAG *</Label>
                  <Select value={selectedTag} onValueChange={setSelectedTag} disabled={toolTags.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={toolTags.length === 0 ? "Todas as TAGs estão em uso" : "Selecione qual TAG está retirando"} />
                    </SelectTrigger>
                    <SelectContent>
                      {toolTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>TAG {tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeTags.length > 0 && (
                    <p className="text-xs text-muted-foreground">TAGs já retiradas: {activeTags.join(", ")}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="construction_site">Obra de Destino *</Label>
                  <ConstructionSiteAutocomplete sites={constructionSites || []} value={constructionSite} onChange={setConstructionSite} />
                </div>
              )}

              {selectedToolId && hasMultipleTags && (
                <div className="space-y-2">
                  <Label htmlFor="construction_site">Obra de Destino *</Label>
                  <ConstructionSiteAutocomplete sites={constructionSites || []} value={constructionSite} onChange={setConstructionSite} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="estimated_return">Previsão de Devolução *</Label>
                <Select value={returnDays} onValueChange={handleReturnDaysChange}>
                  <SelectTrigger id="estimated_return">
                    <SelectValue placeholder="Selecione o prazo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Dia</SelectItem>
                    <SelectItem value="7">7 Dias</SelectItem>
                    <SelectItem value="15">15 Dias</SelectItem>
                    <SelectItem value="30">30 Dias</SelectItem>
                  </SelectContent>
                </Select>
                
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Estado da Ferramenta *</Label>
              <Select value={toolCondition} onValueChange={setToolCondition}>
                <SelectTrigger id="condition">
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incompleta">Incompleta</SelectItem>
                  <SelectItem value="Completa">Completa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" placeholder="Adicione observações sobre o uso..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>



            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className={cn("text-sm font-medium", tagError ? "text-destructive" : "sr-only")}
            >
              {tagError}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !selectedToolId || (hasMultipleTags && !selectedTag) || !constructionSite.trim() || !estimatedReturnDate} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Saída
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/ferramentas")}>Cancelar</Button>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
