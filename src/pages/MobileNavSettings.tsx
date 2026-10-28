import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMobileNavConfig, ALL_TAB_OPTIONS, NavTabItem } from "@/hooks/useMobileNavConfig";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function MobileNavSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { selectedIds, save, reset, maxTabs } = useMobileNavConfig();
  
  // Filter out admin-only tabs for non-admin users
  const availableOptions = ALL_TAB_OPTIONS.filter(
    (t) => !t.adminOnly || isAdmin
  );
  const availableIds = new Set(availableOptions.map(t => t.id));
  const [draft, setDraft] = useState<string[]>(selectedIds.filter(id => availableIds.has(id)));


  const toggleTab = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= maxTabs) {
        toast.error(`Máximo de ${maxTabs} abas permitidas`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    if (draft.length === 0) {
      toast.error("Selecione pelo menos uma aba");
      return;
    }
    save(draft);
    toast.success("Menu atualizado!");
    navigate(-1);
  };

  const handleReset = () => {
    const defaults = isAdmin 
      ? ["home", "ferramentas", "veiculos", "admin"]
      : ["home", "ferramentas", "veiculos"];
    reset();
    setDraft(defaults);
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-lg mx-auto">
      <div className="shrink-0 hidden sm:flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Personalizar Menu</h1>
          <p className="text-xs text-muted-foreground">
            Escolha até {maxTabs} abas para o menu inferior
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-2">
        <div className="bg-card rounded-xl border p-1">
          <div className="flex items-center justify-center gap-2 py-3 border-b mb-2">
            {draft.map((id) => {
              const tab = ALL_TAB_OPTIONS.find((t) => t.id === id);
              if (!tab) return null;
              return (
                <div key={id} className="flex flex-col items-center gap-0.5 w-14">
                  <tab.icon className="w-5 h-5 text-primary" />
                  <span className="text-[9px] text-primary font-medium text-center leading-tight">{tab.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-center text-muted-foreground pb-2">
            Prévia do menu
          </p>
        </div>

        <div className="space-y-1.5">
          {availableOptions.map((tab) => {
            const isSelected = draft.includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => toggleTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98]",
                  isSelected
                    ? "bg-primary/10 border-primary/30"
                    : "bg-card border-border"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "w-4.5 h-4.5",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 text-left">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {tab.label}
                  </span>
                  <p className="text-[10px] text-muted-foreground">{tab.path}</p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 flex gap-2 pt-3 pb-1 border-t bg-background">
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Padrão
        </Button>
        <Button size="sm" onClick={handleSave} className="flex-1 gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Salvar ({draft.length}/{maxTabs})
        </Button>
      </div>
    </div>
  );
}
