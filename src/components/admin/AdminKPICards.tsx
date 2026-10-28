import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Wrench, Car, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface KPIData {
  toolsInUse: number;
  vehiclesOut: number;
  pendingUsers: number;
}

const EMPTY: KPIData = {
  toolsInUse: 0,
  vehiclesOut: 0,
  pendingUsers: 0,
};

async function fetchKPIs(): Promise<KPIData> {
  return api.get<KPIData>("/stats/admin");
}

export function AdminKPICards() {
  const { data = EMPTY, isLoading } = useQuery({
    queryKey: ["admin-kpis"],
    queryFn: fetchKPIs,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const kpis = [
    { label: "Ferramentas em Uso", value: data.toolsInUse, icon: <Wrench className="w-5 h-5" />, color: "text-primary", bg: "bg-primary/10" },
    { label: "Veículos em Uso", value: data.vehiclesOut, icon: <Car className="w-5 h-5" />, color: "text-warning", bg: "bg-warning/10" },
    { label: "Usuários Pendentes", value: data.pendingUsers, icon: <Users className="w-5 h-5" />, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                {kpi.icon}
              </div>
              <div className="min-w-0">
                <p className={`text-2xl font-bold ${kpi.color}`}>
                  {isLoading ? "…" : kpi.value}
                </p>
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
