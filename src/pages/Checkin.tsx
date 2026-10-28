import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleHero } from "@/components/ModuleHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { vibrate, VibrationPatterns, shareContent } from "@/lib/pwa";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from "lucide-react";


import { PhotoCapture } from "@/components/PhotoCapture";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

interface Checkout {
  id: string;
  tool_id: string;
  user_id: string;
  construction_site: string | null;
  estimated_return_date: string | null;
  selected_tag: string | null;
  tools: {
    name: string;
    tag: string | null;
  };
  profiles?: {
    full_name: string;
  } | null;
}

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { isOnline, addPendingOperation } = useOffline();
  const { data: cachedCheckouts, saveToCache } = useOfflineStorage<Checkout[]>("checkouts", []);
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<Checkout[]>(cachedCheckouts || []);
  const [selectedCheckoutId, setSelectedCheckoutId] = useState<string>("");
  const [selectedToolName, setSelectedToolName] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCheckouts, setLoadingCheckouts] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualDate, setManualDate] = useState<string>("");
  const toolIdParam = searchParams.get("toolId");
  const checkoutIdParam = searchParams.get("checkoutId");

  // Warn on unsaved form data
  const hasUnsavedData = !!notes;
  useUnsavedChanges(hasUnsavedData);

  useEffect(() => {
    loadCheckouts();
  }, []);

  const loadCheckouts = async () => {
    try {
      if (!isOnline) {
        if (cachedCheckouts && cachedCheckouts.length > 0) {
          setCheckouts(cachedCheckouts);
          toast.info("Modo offline - usando dados em cache");
        } else {
          toast.warning("Nenhum dado em cache disponível");
        }
        setLoadingCheckouts(false);
        return;
      }

      // Não-admin recebe só as próprias retiradas; admin recebe todas.
      const data = await api.get<any[]>("/tool-checkouts", { status: "checked_out" });

      setCheckouts((data as any) || []);
      saveToCache((data as any) || []);

      if (checkoutIdParam && data) {
        const checkout = data.find(c => c.id === checkoutIdParam);
        if (checkout) {
          setSelectedCheckoutId(checkout.id);
          setSelectedToolName(checkout.tools.name);
          setSelectedTag(checkout.selected_tag || "");
          setSelectedSite(checkout.construction_site || "");
        }
      } else if (toolIdParam && data) {
        const checkout = data.find(c => c.tool_id === toolIdParam);
        if (checkout) {
          setSelectedCheckoutId(checkout.id);
          setSelectedToolName(checkout.tools.name);
          setSelectedTag(checkout.selected_tag || "");
          setSelectedSite(checkout.construction_site || "");
        }
      }
    } catch (error: any) {
      toast.error("Erro ao carregar retiradas", {
        description: error.message,
      });
    } finally {
      setLoadingCheckouts(false);
    }
  };


  const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
  const isAdminActingForOther = !!(isAdmin && selectedCheckout && selectedCheckout.user_id !== profile?.id);
  const visibleCheckouts = isAdmin && !manualMode
    ? checkouts.filter(c => c.user_id === profile?.id)
    : checkouts;


  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCheckoutId) {
      toast.error("Selecione uma retirada");
      return;
    }

    if (isAdminActingForOther && notes.trim().length < 5) {
      toast.error("Justificativa obrigatória", {
        description: "Informe uma observação (mín. 5 caracteres) ao devolver em nome de outro usuário.",
      });
      return;
    }

    if (isAdminActingForOther) {
      const confirmed = window.confirm(
        `Confirmar devolução de "${selectedCheckout!.tools.name}" em nome de ${selectedCheckout!.profiles?.full_name || "outro usuário"}?`
      );
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      const checkinData = {
        checkoutId: selectedCheckoutId,
        updates: {
          status: "checked_in" as const,
          checkin_date: (isAdmin && manualMode && manualDate ? new Date(manualDate) : new Date()).toISOString(),
          checked_in_by: profile!.id,
          notes: notes.trim() ? notes : null,
          checkin_photo_url: null,
        },
      };

      if (!isOnline) {
        addPendingOperation("checkin", checkinData);
        vibrate(VibrationPatterns.success);
        toast.success("Ferramenta devolvida (offline)! Será sincronizada quando conectar.");
        navigate("/ferramentas");
        return;
      }

      await api.post("/tool-checkouts/checkin", {
        ids: [selectedCheckoutId],
        checkin_date: checkinData.updates.checkin_date,
        notes: checkinData.updates.notes,
      });

      vibrate(VibrationPatterns.success);
      toast.success("Ferramenta devolvida com sucesso!", {
        action: {
          label: "Compartilhar",
          onClick: () =>
            shareContent({
              title: "Devolução de ferramenta",
              text: "Devolvi uma ferramenta no Engemase.",
            }),
        },
      });
      navigate("/ferramentas");
    } catch (error: any) {
      toast.error("Erro ao devolver ferramenta", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-4">
      <ModuleHero
        narrow
        eyebrow="Módulo · Ferramentas"
        title="Registrar Devolução"
        subtitle="Registre a devolução de uma ferramenta"
      />

      <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardContent className="pt-4">
          {isAdmin && (
            <div className="space-y-2 mb-4 p-2 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="manual_mode_checkin" className="cursor-pointer text-sm">
                  Devolução manual (em nome de outro)
                </Label>
                <Switch
                  id="manual_mode_checkin"
                  checked={manualMode}
                  onCheckedChange={(v) => {
                    setManualMode(v);
                    setSelectedCheckoutId("");
                    setSelectedToolName("");
                    setSelectedTag("");
                    setSelectedSite("");
                    if (!v) setManualDate("");
                  }}
                />
              </div>
              {manualMode && (
                <>
                  <Label htmlFor="manual_date_checkin">Data e hora da devolução (retroativa, opcional)</Label>
                  <Input
                    id="manual_date_checkin"
                    type="datetime-local"
                    value={manualDate}
                    max={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para usar a data/hora atual.</p>
                </>
              )}
            </div>
          )}
          {visibleCheckouts.length === 0 && !loadingCheckouts ? (
            <p className="text-center text-muted-foreground py-8">
              {isAdmin && !manualMode
                ? "Você não possui ferramentas para devolver. Ative \"Devolução manual\" para devolver em nome de outro usuário."
                : "Nenhuma ferramenta para devolver"}
            </p>
          ) : (
            <form onSubmit={handleCheckin} className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="checkout">Ferramenta para Devolver *</Label>
                  <Select
                    value={selectedCheckoutId}
                    onValueChange={(id) => {
                      setSelectedCheckoutId(id);
                      const checkout = checkouts.find(c => c.id === id);
                      if (checkout) {
                        setSelectedToolName(checkout.tools.name);
                        setSelectedTag(checkout.selected_tag || "");
                        setSelectedSite(checkout.construction_site || "");
                      }
                    }}
                    disabled={loadingCheckouts}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a ferramenta" className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]">
                      {visibleCheckouts.map((checkout) => (
                        <SelectItem key={checkout.id} value={checkout.id} className="whitespace-normal break-words pr-8">
                          <span className="block text-sm leading-snug">
                            {checkout.tools.name}
                            {checkout.selected_tag ? ` (TAG: ${checkout.selected_tag})` : ""}
                            {isAdmin && checkout.profiles?.full_name ? ` — ${checkout.profiles.full_name}` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>

                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Obra de Origem</Label>
                  <Input 
                    value={selectedSite || "Sem obra registrada"} 
                    readOnly 
                    className="bg-muted cursor-default focus-visible:ring-0" 
                  />
                </div>

                <div className="space-y-2">
                  <Label>TAG Identificadora</Label>
                  <Input 
                    value={selectedTag ? `TAG ${selectedTag}` : "Sem TAG"} 
                    readOnly 
                    className="bg-muted cursor-default focus-visible:ring-0" 
                  />
                </div>
              </div>

              {selectedCheckoutId && (
                <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Item selecionado para devolução</span>
                </div>
              )}

              {isAdminActingForOther && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 p-3 rounded-lg text-sm">
                  <strong>Devolução manual:</strong> você está devolvendo em nome de <strong>{selectedCheckout!.profiles?.full_name}</strong>. Justificativa obrigatória abaixo.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Observações {isAdminActingForOther ? "* (justificativa obrigatória)" : "(opcional)"}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={isAdminActingForOther ? "Ex.: usuário ausente, ferramenta devolvida no almoxarifado..." : "Adicione observações sobre o retorno..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="h-14 min-h-14 resize-none"
                  required={isAdminActingForOther}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button type="submit" disabled={loading || !selectedCheckoutId} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Devolução
                </Button>
                

                <Button type="button" variant="outline" onClick={() => navigate("/ferramentas")} className="w-full">
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
