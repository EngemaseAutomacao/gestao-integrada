import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, ChevronDown, ArrowRight, CalendarPlus, CheckSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingCheckout {
  id: string;
  tool_id: string;
  checkout_date: string;
  estimated_return_date: string | null;
  construction_site: string | null;
  selected_tag: string | null;
  tools: { name: string; tag: string | null } | null;
}

interface PendingCheckoutsCardProps {
  pendingCheckouts: PendingCheckout[];
  multiSelectMode: boolean;
  setMultiSelectMode: (v: boolean) => void;
  selectedCheckouts: Set<string>;
  toggleSelectCheckout: (id: string) => void;
  toggleSelectAll: () => void;
  exitMultiSelect: () => void;
  bulkReturnLoading: boolean;
  handleBulkReturn: () => void;
  handleCheckin: (id: string) => void;
  openExtendDialog: (id: string, name: string) => void;
}

export function PendingCheckoutsCard({
  pendingCheckouts,
  multiSelectMode,
  setMultiSelectMode,
  selectedCheckouts,
  toggleSelectCheckout,
  toggleSelectAll,
  exitMultiSelect,
  bulkReturnLoading,
  handleBulkReturn,
  handleCheckin,
  openExtendDialog,
}: PendingCheckoutsCardProps) {
  const [pendingExpanded, setPendingExpanded] = useState(false);

  if (!pendingCheckouts || pendingCheckouts.length === 0) return null;

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setPendingExpanded(!pendingExpanded)}>
        <CardTitle className="text-sm sm:text-base flex items-center justify-between text-warning">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Devoluções Pendentes ({pendingCheckouts.length})
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${pendingExpanded ? "rotate-180" : ""}`} />
        </CardTitle>
      </CardHeader>
      {pendingExpanded && (
        <CardContent className="space-y-2 max-h-[280px] overflow-y-auto pt-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 sticky top-0 bg-warning/5 backdrop-blur py-1 z-10">
            {!multiSelectMode ? (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setMultiSelectMode(true)}>
                <CheckSquare className="w-3 h-3" /> Selecionar várias
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-pending"
                    checked={selectedCheckouts.size === pendingCheckouts.length && pendingCheckouts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all-pending" className="text-xs font-medium cursor-pointer">
                    Selecionar todos
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="text-xs gap-1"
                    disabled={selectedCheckouts.size === 0 || bulkReturnLoading}
                    onClick={handleBulkReturn}
                  >
                    {bulkReturnLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Devolver ({selectedCheckouts.size})
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={exitMultiSelect}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>

          {pendingCheckouts.map((checkout) => {
            const isOverdue = checkout.estimated_return_date && new Date(checkout.estimated_return_date) < new Date();
            const isSelected = selectedCheckouts.has(checkout.id);
            return (
              <div
                key={checkout.id}
                className={`flex items-center justify-between gap-2 p-2 rounded-md transition-colors ${
                  isSelected ? "bg-primary/10 border border-primary/30" : "bg-background/80"
                }`}
              >
                {multiSelectMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelectCheckout(checkout.id)}
                    className="shrink-0"
                  />
                )}
                <div
                  className={`flex-1 min-w-0 ${multiSelectMode ? "cursor-pointer" : ""}`}
                  onClick={() => multiSelectMode && toggleSelectCheckout(checkout.id)}
                >
                  {multiSelectMode ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{checkout.tools?.name}</p>
                        {checkout.selected_tag && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            {checkout.selected_tag}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {checkout.estimated_return_date && (
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>
                            {isOverdue ? "⚠️ Atrasado" : `Devolver até ${format(new Date(checkout.estimated_return_date), "dd/MM", { locale: ptBR })}`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <Link
                      to={`/ferramentas/${checkout.tool_id}`}
                      className="block hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate underline-offset-2 hover:underline">{checkout.tools?.name}</p>
                        {checkout.selected_tag && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            {checkout.selected_tag}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {checkout.estimated_return_date && (
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>
                            {isOverdue ? "⚠️ Atrasado" : `Devolver até ${format(new Date(checkout.estimated_return_date), "dd/MM", { locale: ptBR })}`}
                          </span>
                        )}
                      </div>
                    </Link>
                  )}
                </div>

                {!multiSelectMode && (
                  <div className="flex gap-1 shrink-0">
                    {isOverdue && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1 text-warning hover:text-warning/80"
                        onClick={() => openExtendDialog(checkout.id, checkout.tools?.name || "")}
                      >
                        <CalendarPlus className="w-3 h-3" /> Prorrogar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleCheckin(checkout.id)}>
                      Registrar Devolução <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
