import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogIn, LogOut, AlertTriangle, Wrench, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  id: string;
  date: string;
  action: string;
  description: string;
  user: string;
  type?: "checkout" | "checkin" | "issue" | "maintenance" | "transfer";
}

interface AssetTimelineProps {
  events: TimelineEvent[];
}

function getTimelineIcon(type?: string) {
  switch (type) {
    case "checkout": return <LogOut className="w-4 h-4" />;
    case "checkin": return <LogIn className="w-4 h-4" />;
    case "issue": return <AlertTriangle className="w-4 h-4" />;
    case "maintenance": return <Wrench className="w-4 h-4" />;
    case "transfer": return <ArrowRightLeft className="w-4 h-4" />;
    default: return <LogOut className="w-4 h-4" />;
  }
}

function getTimelineColor(type?: string) {
  switch (type) {
    case "checkout": return "bg-primary text-primary-foreground";
    case "checkin": return "bg-success text-success-foreground";
    case "issue": return "bg-destructive text-destructive-foreground";
    case "maintenance": return "bg-warning text-warning-foreground";
    case "transfer": return "bg-secondary text-secondary-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

function getActionLabel(type?: string) {
  switch (type) {
    case "checkout": return "Retirada";
    case "checkin": return "Devolução";
    case "issue": return "Problema";
    case "maintenance": return "Manutenção";
    case "transfer": return "Transferência";
    default: return "Evento";
  }
}

export function AssetTimeline({ events }: AssetTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Nenhum evento encontrado
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="relative flex gap-4 pl-2">
            {/* Icon circle */}
            <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${getTimelineColor(event.type)}`}>
              {getTimelineIcon(event.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-xs">
                  {getActionLabel(event.type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm">{event.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">por {event.user}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
