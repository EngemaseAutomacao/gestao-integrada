import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ModuleHero } from "@/components/ModuleHero";
import { Loader2, Wrench, User, Calendar, LogIn, Search, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ToolInUseRow {
  id: string;
  tool_id: string;
  user_id: string;
  checkout_date: string;
  estimated_return_date: string | null;
  selected_tag: string | null;
  construction_site: string | null;
  notes: string | null;
  tools: { name: string; tag: string | null } | null;
  profiles: { full_name: string; username: string | null; category: string | null } | null;
}

export default function AdminToolsInUse() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [returnTarget, setReturnTarget] = useState<ToolInUseRow | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [loading, setLoading] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["admin-tools-in-use"],
    queryFn: async () => {
      return api.get<ToolInUseRow[]>("/tool-checkouts", { status: "checked_out" });
    },
  });

  const rows = (data || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.tools?.name?.toLowerCase().includes(q) ||
      r.tools?.tag?.toLowerCase().includes(q) ||
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.profiles?.username?.toLowerCase().includes(q) ||
      r.construction_site?.toLowerCase().includes(q)
    );
  });

  const handleReturn = async () => {
    if (!returnTarget || !profile?.id) return;
    const trimmed = returnNotes.trim();
    if (trimmed.length < 5) {
      toast.error("Justificativa obrigatória (mín. 5 caracteres).");
      return;
    }
    setLoading(true);
    try {
      // O servidor acrescenta esta justificativa às observações já existentes.
      const justification = `[Devolução manual pelo admin ${profile.full_name || profile.username || "admin"} em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}] ${trimmed}`;
      await api.post("/tool-checkouts/checkin", { ids: [returnTarget.id], notes: justification });
      toast.success("Devolução registrada com sucesso.");
      setReturnTarget(null);
      setReturnNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-tools-in-use"] });
    } catch (err: any) {
      toast.error("Erro ao registrar devolução", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (profile && profile.role !== "admin") return <Navigate to="/" />;
  return (
    <div className="animate-fade-in">
      <ModuleHero
        eyebrow="Módulo · Administração"
        title="Ferramentas em Uso"
        subtitle="Todas as ferramentas atualmente retiradas e seus responsáveis"
      />
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por ferramenta, usuário ou obra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="whitespace-nowrap">
            {rows.length} em uso
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhuma ferramenta em uso no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const overdue =
                row.estimated_return_date &&
                new Date(row.estimated_return_date) < new Date();
              return (
                <Card key={row.id} className="overflow-hidden">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wrench className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm sm:text-base truncate">
                            {row.tools?.name || "Ferramenta"}
                          </span>
                          {row.selected_tag && (
                            <Badge variant="outline" className="text-xs">
                              TAG {row.selected_tag}
                            </Badge>
                          )}
                          {overdue && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" /> Atrasada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {row.profiles?.full_name || "Usuário"}
                            {row.profiles?.username && (
                              <span className="ml-1 opacity-70">@{row.profiles.username}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Retirada em{" "}
                          {format(new Date(row.checkout_date), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                          {row.estimated_return_date && (
                            <>
                              {" · "}
                              Previsão:{" "}
                              {format(new Date(row.estimated_return_date), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </>
                          )}
                        </div>
                        {row.construction_site && (
                          <div className="text-xs text-muted-foreground">
                            Obra: <span className="text-foreground">{row.construction_site}</span>
                          </div>
                        )}
                        {row.notes && (
                          <div className="text-xs bg-muted/50 rounded-md p-2 mt-1 whitespace-pre-wrap">
                            {row.notes}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReturnTarget(row);
                          setReturnNotes("");
                        }}
                        className="gap-1.5 shrink-0"
                      >
                        <LogIn className="h-4 w-4" />
                        Devolver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!returnTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReturnTarget(null);
            setReturnNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver ferramenta</DialogTitle>
            <DialogDescription>
              Você vai devolver{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.tools?.name}
              </span>{" "}
              em nome de{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.profiles?.full_name}
              </span>
              . A ação ficará registrada em seu nome.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-notes">Justificativa (mín. 5 caracteres)</Label>
            <Textarea
              id="return-notes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={4}
              placeholder="Ex.: usuário devolveu presencialmente sem registrar no app"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnTarget(null);
                setReturnNotes("");
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleReturn} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
