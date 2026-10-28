import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tool {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  brand: string | null;
  condition: string | null;
  quantity_available: number;
  quantity_total: number;
  employee_only: boolean;
}

interface ToolCardProps {
  tool: Tool;
  userCheckouts: any[];
  conditionLabels: Record<string, string>;
  onNavigate: (path: string) => void;
  onEnlargeImage: (url: string) => void;
  onCheckout: (id: string) => void;
  onCheckin: (id: string) => void;
  onExtend: (id: string, name: string) => void;
}

export function ToolCard({
  tool,
  userCheckouts,
  conditionLabels,
  onNavigate,
  onCheckout,
  onCheckin,
  onExtend,
}: ToolCardProps) {
  const userCheckout = userCheckouts[0];
  const userHasTool = userCheckouts.length > 0;
  const userTags = new Set(userCheckouts.map((c: any) => (c.selected_tag || "").trim()).filter(Boolean));
  const isOverdue = Boolean(
    userCheckout?.estimated_return_date && new Date(userCheckout.estimated_return_date) < new Date()
  );
  const overdueDays = isOverdue && userCheckout?.estimated_return_date
    ? Math.ceil((new Date().getTime() - new Date(userCheckout.estimated_return_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const assignedByAdmin = userCheckouts.some((c: any) => c.checked_out_by && c.user_id && c.checked_out_by !== c.user_id);


  return (
    <Card
      className={cn("cursor-pointer hover:bg-accent/50 transition-colors", isOverdue && "border-destructive/50")}
      onClick={() => onNavigate(`/ferramentas/${tool.id}`)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm sm:text-base capitalize">{tool.name.toLowerCase()}</h3>
                {(() => {
                  const allTags = tool.tag ? tool.tag.split(",").map(t => t.trim()).filter(Boolean) : [];
                  const MAX_VISIBLE = 5;
                  const mineTags = allTags.filter(t => userTags.has(t));
                  const otherTags = allTags.filter(t => !userTags.has(t));
                  const ordered = [...mineTags, ...otherTags];
                  const visible = ordered.slice(0, MAX_VISIBLE);
                  const hidden = ordered.length - visible.length;
                  return (
                    <>
                      {visible.map((tag) => {
                        const mine = userTags.has(tag);
                        return (
                          <Badge
                            key={tag}
                            className={`text-xs ${mine ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}`}
                            variant={mine ? "default" : "secondary"}
                          >
                            {mine ? `🔧 ${tag}` : tag}
                          </Badge>
                        );
                      })}
                      {hidden > 0 && (
                        <Badge variant="outline" className="text-xs" title={ordered.slice(MAX_VISIBLE).join(", ")}>
                          +{hidden}
                        </Badge>
                      )}
                    </>
                  );
                })()}

                {tool.brand && <Badge variant="outline" className="text-xs">{tool.brand}</Badge>}
                {tool.employee_only && <Badge variant="outline" className="text-xs">Apenas Funcionários</Badge>}
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    ⚠️ Atrasado {overdueDays}d
                  </Badge>
                )}
                {assignedByAdmin && (
                  <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500/90">
                    Atribuído pelo admin
                  </Badge>
                )}

              </div>
              {tool.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                  {tool.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs sm:text-sm">
                <span className={tool.quantity_available > 0 ? "text-success" : "text-destructive"}>
                  Disponível: {tool.quantity_available}/{tool.quantity_total}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-end sm:self-start" onClick={(e) => e.stopPropagation()}>
            {userHasTool && (
              <>
                {isOverdue && userCheckout && (
                  <Button size="sm" variant="ghost" className="text-xs sm:text-sm" onClick={() => onExtend(userCheckout.id, tool.name)}>
                    <CalendarPlus className="w-3 h-3" /> Prorrogar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={() => onCheckin(userCheckout?.id || "")}>
                  Registrar Devolução
                </Button>
              </>
            )}
            {tool.quantity_available > 0 && (
              <Button size="sm" className="text-xs sm:text-sm" onClick={() => onCheckout(tool.id)}>
                Registrar Saída
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => onNavigate(`/ferramentas/${tool.id}`)} aria-label="Ver detalhes">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
