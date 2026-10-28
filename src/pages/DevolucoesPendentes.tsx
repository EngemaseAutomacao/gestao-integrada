import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock,
  ChevronRight,
  CheckCircle2,
  Loader2,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PendingItem {
  id: string;
  tool_id: string;
  checkout_date: string;
  estimated_return_date: string | null;
  selected_tag: string | null;
  construction_site: string | null;
  notes: string | null;
  tools: { name: string; tag: string | null } | null;
}

export default function DevolucoesPendentes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["devolucoes-pendentes", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const data = await api.get<PendingItem[]>("/tool-checkouts", {
        status: "checked_out",
        scope: "mine",
        order: "estimated_return_date",
        dir: "asc",
      });
      return data;
    },
    enabled: !!profile?.id,
  });

  const items = data || [];
  const overdueCount = items.filter(
    (p) => p.estimated_return_date && new Date(p.estimated_return_date) < new Date()
  ).length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelected(new Set());
  };

  const handleSingleReturn = (id: string) => {
    navigate(`/ferramentas/devolucao?checkoutId=${id}`);
  };

  const handleBulkReturn = async () => {
    if (selected.size === 0 || !profile?.id) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      await api.post("/tool-checkouts/checkin", { ids });
      toast.success(`${ids.length} ferramenta(s) devolvida(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["devolucoes-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["pending-tool-checkouts"] });
      queryClient.invalidateQueries({ queryKey: ["home-pending-count"] });
      exitMultiSelect();
    } catch (error: any) {
      toast.error("Erro ao devolver ferramentas", { description: error.message });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {items.length} ferramenta{items.length > 1 ? "s" : ""} para devolver
            {overdueCount > 0 && (
              <span className="text-destructive font-medium">
                {" "}· {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
          {!multiSelectMode ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setMultiSelectMode(true)}
            >
              <CheckSquare className="w-4 h-4" /> Devolução em lote
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selected.size === items.length && items.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                  Selecionar todas
                </label>
              </div>
              <Button
                size="sm"
                disabled={selected.size === 0 || bulkLoading}
                onClick={handleBulkReturn}
                className="gap-1"
              >
                {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Devolver ({selected.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={exitMultiSelect}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm mt-1">Você não tem ferramentas para devolver.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {items.map((p) => {
              const overdue =
                p.estimated_return_date && new Date(p.estimated_return_date) < new Date();
              const isSelected = selected.has(p.id);

              const info = (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium break-words">
                      {p.tools?.name || "Ferramenta"}
                    </p>
                    {p.selected_tag && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 font-mono"
                      >
                        {p.selected_tag}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={`text-xs ${
                      overdue ? "text-destructive font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {p.estimated_return_date
                      ? overdue
                        ? `⚠️ Atrasada desde ${format(
                            new Date(p.estimated_return_date),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}`
                        : `Devolver até ${format(
                            new Date(p.estimated_return_date),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}`
                      : `Retirada em ${format(new Date(p.checkout_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}`}
                  </p>
                  {p.construction_site && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Obra: {p.construction_site}
                    </p>
                  )}
                  {p.notes && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">
                      Obs: {p.notes}
                    </p>
                  )}
                </div>
              );

              return (
                <li key={p.id}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    {multiSelectMode ? (
                      <>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(p.id)}
                          className="shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => toggleSelect(p.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          {info}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/ferramentas/${p.tool_id}`}
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              overdue
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning/10 text-warning"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          {info}
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 shrink-0"
                          onClick={() => handleSingleReturn(p.id)}
                        >
                          Devolver <ArrowRight className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
