import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Package, History, Calendar, MapPin, Clock } from "lucide-react";
import { ModuleHero } from "@/components/ModuleHero";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}


interface CheckoutRecord {
  id: string;
  checkout_date: string;
  checkin_date: string | null;
  status: string;
  construction_site: string | null;
  selected_tag: string | null;
  notes: string | null;
  user_profile: {
    full_name: string;
    email: string;
    category: string;
  } | null;
}

const conditionLabels: Record<string, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Regular",
  poor: "Ruim",
  needs_maintenance: "Precisa Manutenção",
};

const conditionColors: Record<string, string> = {
  excellent: "bg-success",
  good: "bg-primary",
  fair: "bg-warning",
  poor: "bg-warning",
  needs_maintenance: "bg-destructive",
};


export default function ToolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  
  const [checkouts, setCheckouts] = useState<CheckoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("all");


  const tags = tool?.tag ? tool.tag.split(",").map(t => t.trim()).filter(Boolean) : [];
  const hasMultipleTags = tags.length > 1;

  useEffect(() => {
    if (id) {
      loadToolData();
    }
  }, [id]);

  const loadToolData = async () => {
    try {
      const [toolData, checkoutData] = await Promise.all([
        api.get<any>(`/tools/${id}`),
        api.get<any[]>(`/tools/${id}/checkouts`),
      ]);
      setTool(toolData);
      setCheckouts(checkoutData.map((c) => ({ ...c, user_profile: c.profiles })) as any);
    } catch (error: any) {
      toast.error("Erro ao carregar dados", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };




  const getCheckoutsForTag = (tag: string) => {
    return checkouts.filter(c => c.selected_tag === tag);
  };

  const getDaysUsed = (checkout: CheckoutRecord) => {
    const start = new Date(checkout.checkout_date);
    const end = checkout.checkin_date ? new Date(checkout.checkin_date) : new Date();
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const renderCheckoutCard = (checkout: CheckoutRecord, showTag = false) => (
    <Card key={checkout.id}>
      <CardContent className="p-3 md:p-4">
        <div className="space-y-2 md:space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm md:text-base truncate">{checkout.user_profile?.full_name || "Usuário não encontrado"}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {showTag && checkout.selected_tag && (
                <Badge variant="outline" className="text-xs">
                  {checkout.selected_tag}
                </Badge>
              )}
              <Badge variant={checkout.status === "checked_out" ? "default" : "secondary"} className="text-xs">
                {checkout.status === "checked_out" ? "Em Uso" : "Devolvida"}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Retirada</p>
                <p>{format(new Date(checkout.checkout_date), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
            
            {checkout.checkin_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground">Devolução</p>
                  <p>{format(new Date(checkout.checkin_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-xs md:text-sm">
            {checkout.construction_site && (
              <div className="flex items-start gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="break-words">{checkout.construction_site}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{getDaysUsed(checkout)} dias</span>
            </div>
          </div>


          {checkout.notes && (
            <div className="text-xs md:text-sm bg-muted/50 rounded-md p-2 border-l-2 border-primary">
              <p className="text-muted-foreground font-medium mb-0.5">Observação</p>
              <p className="whitespace-pre-wrap break-words">{checkout.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading || !tool) {
    return (
      <div className="flex items-center justify-center h-full">
        <Package className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 h-full min-h-0 pb-2">
      <ModuleHero
        eyebrow="Módulo · Ferramentas"
        title={tool.name}
        subtitle="Detalhes e histórico completo"
        floating={
          <div className="rounded-2xl bg-card border shadow-elevated p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {tool.tag && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">TAG</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs font-mono">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {tool.brand && (
                <div>
                  <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Marca</p>
                  <p className="text-sm font-medium mt-1">{tool.brand}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Disponível/Total</p>
                <p className="text-sm font-medium mt-1">
                  {tool.quantity_available}/{tool.quantity_total}
                </p>
              </div>
            </div>
          </div>
        }
      />

      {tool.description && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Informações da Ferramenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div>
              <p className="text-xs md:text-sm font-medium mb-1">Descrição</p>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Usage History */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="p-4 md:p-6 shrink-0">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <History className="w-4 h-4 md:w-5 md:h-5" />
            Histórico de Uso
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {checkouts.length} registros de uso
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0 flex-1 min-h-0 flex flex-col">

          {checkouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Nenhum uso registrado
            </p>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {hasMultipleTags && (
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-full h-9 text-xs shrink-0">
                    <SelectValue placeholder="Filtrar por TAG" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Todas as TAGs ({checkouts.length})
                    </SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag} value={tag} className="text-xs">
                        <span className="font-mono">{tag}</span>
                        <span className="ml-2 opacity-70">({getCheckoutsForTag(tag).length})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                {(tagFilter === "all" ? checkouts : getCheckoutsForTag(tagFilter)).length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">
                    Nenhum uso registrado para TAG {tagFilter}
                  </p>
                ) : (
                  (tagFilter === "all" ? checkouts : getCheckoutsForTag(tagFilter)).map((checkout) =>
                    renderCheckoutCard(checkout, tagFilter === "all")
                  )
                )}
              </div>
            </div>
          )}




        </CardContent>
      </Card>

    </div>
  );
}
