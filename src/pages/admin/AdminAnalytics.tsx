
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, AlertTriangle, Package, Users, Wrench, Trophy, CalendarIcon, Car } from "lucide-react";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import { Navigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Line, AreaChart, Area, ComposedChart } from "recharts";
import { format, subMonths, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { InteractiveLegend, useInteractiveLegend } from "@/components/analytics/InteractiveLegend";

interface ToolUsageData {
  name: string;
  count: number;
}

interface DelayRateData {
  name: string;
  delays: number;
  total: number;
  rate: number;
}

interface MonthlyData {
  month: string;
  checkouts: number;
  checkins: number;
  delays: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface UserRankingData {
  name: string;
  checkouts: number;
  category: string;
}

interface AnalyticsMetrics {
  totalCheckouts: number;
  averageUsageDays: number;
  totalDelays: number;
  activeCheckouts: number;
  totalTools: number;
  toolsInUse: number;
  totalUsers: number;
  maintenanceCount: number;
  totalVehicleCheckouts: number;
  totalKmDriven: number;
  activeVehicles: number;
}

interface VehicleMonthlyData {
  month: string;
  checkouts: number;
  km: number;
}

const EMPTY_METRICS: AnalyticsMetrics = {
  totalCheckouts: 0,
  averageUsageDays: 0,
  totalDelays: 0,
  activeCheckouts: 0,
  totalTools: 0,
  toolsInUse: 0,
  totalUsers: 0,
  maintenanceCount: 0,
  totalVehicleCheckouts: 0,
  totalKmDriven: 0,
  activeVehicles: 0,
};

interface AnalyticsBundle {
  metrics: AnalyticsMetrics;
  topTools: ToolUsageData[];
  delaysBySite: DelayRateData[];
  delaysByUser: DelayRateData[];
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  userRanking: UserRankingData[];
  vehicleMonthlyData: VehicleMonthlyData[];
}

export default function AdminAnalytics() {
  const { profile } = useAuth();
  const [periodFilter, setPeriodFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const toolsTrendLegend = useInteractiveLegend([
    { key: "checkouts", name: "Retiradas", defaultColor: "hsl(var(--primary))", fallbackHex: "#2563eb" },
    { key: "checkins", name: "Devoluções", defaultColor: "hsl(var(--chart-2))", fallbackHex: "#10b981" },
    { key: "delays", name: "Atrasos", defaultColor: "hsl(var(--destructive))", fallbackHex: "#ef4444" },
  ]);
  const vehiclesTrendLegend = useInteractiveLegend([
    { key: "checkouts", name: "Saídas", defaultColor: "hsl(var(--chart-2))", fallbackHex: "#10b981" },
    { key: "km", name: "KM Rodado", defaultColor: "hsl(var(--primary))", fallbackHex: "#2563eb" },
  ]);
  const categoryLegend = useInteractiveLegend([
    { key: "Funcionários", name: "Funcionários", defaultColor: "hsl(var(--chart-1))", fallbackHex: "#2563eb" },
    { key: "Terceirizados", name: "Terceirizados", defaultColor: "hsl(var(--chart-2))", fallbackHex: "#10b981" },
  ]);

  const getDateRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (periodFilter) {
      case "7d": return { from: subDays(now, 7), to: now };
      case "30d": return { from: subDays(now, 30), to: now };
      case "90d": return { from: subDays(now, 90), to: now };
      case "6m": return { from: subMonths(now, 6), to: now };
      case "1y": return { from: startOfYear(now), to: now };
      case "custom": return { from: startDate || null, to: endDate || null };
      default: return { from: null, to: null };
    }
  };

  const { data: analytics, isLoading: loading } = useQuery<AnalyticsBundle>({
    queryKey: ["admin-analytics", periodFilter, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => loadAnalytics(getDateRange()),
    enabled: !!profile && profile.role === "admin",
    staleTime: 60_000,
  });

  const metrics = analytics?.metrics ?? EMPTY_METRICS;
  const topTools = analytics?.topTools ?? [];
  const delaysBySite = analytics?.delaysBySite ?? [];
  const delaysByUser = analytics?.delaysByUser ?? [];
  const monthlyData = analytics?.monthlyData ?? [];
  const categoryData = analytics?.categoryData ?? [];
  const userRanking = analytics?.userRanking ?? [];
  const vehicleMonthlyData = analytics?.vehicleMonthlyData ?? [];

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  async function loadAnalytics(range: { from: Date | null; to: Date | null }): Promise<AnalyticsBundle> {
    const { checkouts, tools, users, vehicleCheckouts } = await api.get<{
      checkouts: any[];
      tools: { id: string; quantity_available: number; quantity_total: number }[];
      users: { id: string; category: string }[];
      vehicleCheckouts: {
        id: string;
        checkout_date: string;
        checkin_date: string | null;
        km_checkout: number | null;
        km_checkin: number | null;
        status: string | null;
      }[];
    }>("/stats/analytics", {
      from: range.from?.toISOString(),
      to: range.to?.toISOString(),
    });
    const maintenances: { id: string }[] = [];

    const totalCheckouts = checkouts?.length || 0;
    const activeCheckouts = checkouts?.filter(c => c.status === "checked_out").length || 0;
    const totalTools = tools?.length || 0;
    const toolsInUse = tools?.filter(t => t.quantity_available < t.quantity_total).length || 0;
    const totalUsers = users?.length || 0;
    const maintenanceCount = maintenances?.length || 0;
    const totalVehicleCheckouts = vehicleCheckouts?.length || 0;
    const activeVehicles = vehicleCheckouts?.filter(v => v.status === "checked_out").length || 0;
    // Só considera diferença válida quando km_checkin > km_checkout.
    // Registros inconsistentes (checkin <= checkout) são ignorados para evitar KM negativo.
    const totalKmDriven = vehicleCheckouts?.reduce((sum, v) => {
      if (v.km_checkin != null && v.km_checkout != null && v.km_checkin > v.km_checkout) {
        return sum + (v.km_checkin - v.km_checkout);
      }
      return sum;
    }, 0) || 0;

    const completedCheckouts = checkouts?.filter(c => c.checkin_date) || [];
    const totalDays = completedCheckouts.reduce((sum, c) => {
      const checkout = new Date(c.checkout_date);
      const checkin = new Date(c.checkin_date!);
      const days = (checkin.getTime() - checkout.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    const averageUsageDays = completedCheckouts.length > 0
      ? Math.round(totalDays / completedCheckouts.length)
      : 0;

    const totalDelays = checkouts?.filter(c => {
      if (!c.estimated_return_date) return false;
      const returnDate = c.checkin_date ? new Date(c.checkin_date) : new Date();
      return returnDate > new Date(c.estimated_return_date);
    }).length || 0;

    const vMonthlyStats: VehicleMonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthVCheckouts = vehicleCheckouts?.filter(v => {
        const d = new Date(v.checkout_date);
        return d >= monthStart && d <= monthEnd;
      }) || [];
      const monthKm = monthVCheckouts.reduce((sum, v) => {
        if (v.km_checkin != null && v.km_checkout != null && v.km_checkin > v.km_checkout) {
          return sum + (v.km_checkin - v.km_checkout);
        }
        return sum;
      }, 0);
      vMonthlyStats.push({
        month: format(date, "MMM/yy", { locale: ptBR }),
        checkouts: monthVCheckouts.length,
        km: monthKm,
      });
    }

    const toolCounts: Record<string, number> = {};
    checkouts?.forEach(c => {
      const toolName = (c as any).tools?.name || "Desconhecido";
      toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
    });
    const topToolsData = Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const siteDelays: Record<string, { delays: number; total: number }> = {};
    checkouts?.forEach(c => {
      const site = c.construction_site || "Sem Obra";
      if (!siteDelays[site]) siteDelays[site] = { delays: 0, total: 0 };
      siteDelays[site].total += 1;
      if (c.estimated_return_date) {
        const returnDate = c.checkin_date ? new Date(c.checkin_date) : new Date();
        if (returnDate > new Date(c.estimated_return_date)) siteDelays[site].delays += 1;
      }
    });
    const siteDelayData = Object.entries(siteDelays)
      .map(([name, data]) => ({
        name,
        delays: data.delays,
        total: data.total,
        rate: Math.round((data.delays / data.total) * 100),
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    const userDelays: Record<string, { delays: number; total: number }> = {};
    checkouts?.forEach(c => {
      const userName = (c as any).profiles?.full_name || "Desconhecido";
      if (!userDelays[userName]) userDelays[userName] = { delays: 0, total: 0 };
      userDelays[userName].total += 1;
      if (c.estimated_return_date) {
        const returnDate = c.checkin_date ? new Date(c.checkin_date) : new Date();
        if (returnDate > new Date(c.estimated_return_date)) userDelays[userName].delays += 1;
      }
    });
    const userDelayData = Object.entries(userDelays)
      .map(([name, data]) => ({
        name,
        delays: data.delays,
        total: data.total,
        rate: Math.round((data.delays / data.total) * 100),
      }))
      .filter(d => d.delays > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    const monthlyStats: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const monthCheckouts = checkouts?.filter(c => {
        const checkoutDate = new Date(c.checkout_date);
        return checkoutDate >= monthStart && checkoutDate <= monthEnd;
      }) || [];

      const monthCheckins = checkouts?.filter(c => {
        if (!c.checkin_date) return false;
        const checkinDate = new Date(c.checkin_date);
        return checkinDate >= monthStart && checkinDate <= monthEnd;
      }) || [];

      const monthDelays = monthCheckouts.filter(c => {
        if (!c.estimated_return_date) return false;
        const returnDate = c.checkin_date ? new Date(c.checkin_date) : new Date();
        return returnDate > new Date(c.estimated_return_date);
      }).length;

      monthlyStats.push({
        month: format(date, "MMM/yy", { locale: ptBR }),
        checkouts: monthCheckouts.length,
        checkins: monthCheckins.length,
        delays: monthDelays,
      });
    }

    const employeeCheckouts = checkouts?.filter(c => (c as any).profiles?.category === "engemase_employee").length || 0;
    const thirdPartyCheckouts = checkouts?.filter(c => (c as any).profiles?.category === "third_party").length || 0;

    const userCounts: Record<string, { count: number; category: string }> = {};
    checkouts?.forEach(c => {
      const userName = (c as any).profiles?.full_name || "Desconhecido";
      const userCat = (c as any).profiles?.category === "engemase_employee" ? "Funcionário" : "Terceirizado";
      if (!userCounts[userName]) userCounts[userName] = { count: 0, category: userCat };
      userCounts[userName].count += 1;
    });
    const userRankingData = Object.entries(userCounts)
      .map(([name, data]) => ({ name, checkouts: data.count, category: data.category }))
      .sort((a, b) => b.checkouts - a.checkouts)
      .slice(0, 10);

    return {
      metrics: {
        totalCheckouts,
        averageUsageDays,
        totalDelays,
        activeCheckouts,
        totalTools,
        toolsInUse,
        totalUsers,
        maintenanceCount,
        totalVehicleCheckouts,
        totalKmDriven,
        activeVehicles,
      },
      topTools: topToolsData,
      delaysBySite: siteDelayData,
      delaysByUser: userDelayData,
      monthlyData: monthlyStats,
      categoryData: [
        { name: "Funcionários", value: employeeCheckouts },
        { name: "Terceirizados", value: thirdPartyCheckouts },
      ],
      userRanking: userRankingData,
      vehicleMonthlyData: vMonthlyStats,
    };
  }


  if (loading) {
    return (
      <DashboardSkeleton />
    );
  }

  const delayRate = metrics.totalCheckouts > 0
    ? Math.round((metrics.totalDelays / metrics.totalCheckouts) * 100)
    : 0;
  const avgKmPerTrip = metrics.totalVehicleCheckouts > 0
    ? Math.round(metrics.totalKmDriven / metrics.totalVehicleCheckouts)
    : 0;

  return (
    <div className="space-y-4">
      {/* Compact Header + Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Dashboard Analítico</h1>
            <p className="text-xs text-muted-foreground">Métricas de ferramentas e veículos</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="1y">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodFilter === "custom" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Bento Grid KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 auto-rows-[110px] gap-3">
        {/* Em Uso (destaque - primary) */}
        <Card className="col-span-2 row-span-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
          <CardContent className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em Uso Agora</p>
                <p className="text-4xl font-bold text-primary mt-1">{metrics.activeCheckouts}</p>
                <p className="text-xs text-muted-foreground mt-1">Ferramentas não devolvidas</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
            {monthlyData.length > 0 && (
              <div className="h-14 -mx-1 -mb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="checkouts" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradPrimary)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atrasos (destaque - destructive) */}
        <Card className="col-span-2 row-span-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent relative overflow-hidden">
          <CardContent className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total de Atrasos</p>
                <p className="text-4xl font-bold text-destructive mt-1">{metrics.totalDelays}</p>
                <p className="text-xs text-muted-foreground mt-1">{delayRate}% das retiradas</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            </div>
            {monthlyData.length > 0 && (
              <div className="h-14 -mx-1 -mb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gradDestructive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="delays" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gradDestructive)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Retiradas */}
        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Retiradas</p>
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{metrics.totalCheckouts}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Total geral</p>
            </div>
          </CardContent>
        </Card>

        {/* Tempo Médio */}
        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tempo Médio</p>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{metrics.averageUsageDays}<span className="text-sm font-normal text-muted-foreground ml-1">dias</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">De uso</p>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Atraso — colspan 2 */}
        <Card className={cn("col-span-2", delayRate > 20 ? "border-warning/40 bg-warning/5" : "")}>
          <CardContent className="p-3 h-full flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Taxa de Atraso</p>
              <p className={cn("text-2xl font-bold leading-none mt-1", delayRate > 20 ? "text-warning" : delayRate > 0 ? "text-foreground" : "text-muted-foreground")}>{delayRate}%</p>
            </div>
            <div className={cn("rounded-lg p-2", delayRate > 20 ? "bg-warning/10" : "bg-muted")}>
              <AlertTriangle className={cn("h-4 w-4", delayRate > 20 ? "text-warning" : "text-muted-foreground")} />
            </div>
          </CardContent>
        </Card>

        {/* Row 3: Ferramentas, Usuários, Manutenções, Saídas, KM Total, KM Médio */}
        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ferramentas</p>
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{metrics.totalTools}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{metrics.toolsInUse} em uso</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Usuários</p>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{metrics.totalUsers}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Cadastrados</p>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Saídas Veíc.</p>
              <Car className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{metrics.totalVehicleCheckouts}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{metrics.activeVehicles} em uso</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">KM Total</p>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none tabular-nums">{metrics.totalKmDriven.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">km rodados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">KM Médio</p>
              <Car className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none tabular-nums">{avgKmPerTrip.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">km / viagem</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Mensal</CardTitle>
          <CardDescription>Retiradas, devoluções e atrasos nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Area type="monotone" dataKey="checkouts" name="Retiradas" stackId="1" stroke={toolsTrendLegend.getColor("checkouts")} fill={toolsTrendLegend.getColor("checkouts")} fillOpacity={0.6} hide={toolsTrendLegend.isHidden("checkouts")} />
              <Area type="monotone" dataKey="checkins" name="Devoluções" stackId="2" stroke={toolsTrendLegend.getColor("checkins")} fill={toolsTrendLegend.getColor("checkins")} fillOpacity={0.6} hide={toolsTrendLegend.isHidden("checkins")} />
              <Area type="monotone" dataKey="delays" name="Atrasos" stackId="3" stroke={toolsTrendLegend.getColor("delays")} fill={toolsTrendLegend.getColor("delays")} fillOpacity={0.6} hide={toolsTrendLegend.isHidden("delays")} />
            </AreaChart>
          </ResponsiveContainer>
          <InteractiveLegend controller={toolsTrendLegend} />
        </CardContent>
      </Card>

      {/* Vehicle Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Mensal - Veículos</CardTitle>
          <CardDescription>Saídas e quilometragem nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={vehicleMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Bar yAxisId="left" dataKey="checkouts" name="Saídas" fill={vehiclesTrendLegend.getColor("checkouts")} hide={vehiclesTrendLegend.isHidden("checkouts")} />
              <Line yAxisId="right" type="monotone" dataKey="km" name="KM Rodado" stroke={vehiclesTrendLegend.getColor("km")} strokeWidth={2} dot={{ r: 4 }} hide={vehiclesTrendLegend.isHidden("km")} />
            </ComposedChart>
          </ResponsiveContainer>
          <InteractiveLegend controller={vehiclesTrendLegend} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Tools Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ferramentas Mais Requisitadas</CardTitle>
            <CardDescription>Top 10 ferramentas por número de retiradas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topTools} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Uso por Categoria</CardTitle>
            <CardDescription>Distribuição de retiradas por tipo de usuário</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData.filter((d) => !categoryLegend.isHidden(d.name))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {categoryData
                    .filter((d) => !categoryLegend.isHidden(d.name))
                    .map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={categoryLegend.getColor(entry.name)} />
                    ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <InteractiveLegend controller={categoryLegend} />
          </CardContent>
        </Card>
      </div>

      {/* Ranking Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Tools Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Ranking de Ferramentas
            </CardTitle>
            <CardDescription>Ferramentas mais retiradas do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topTools.slice(0, 10).map((tool, index) => (
                <div key={tool.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                    index === 1 ? "bg-gray-300/30 text-gray-600" :
                    index === 2 ? "bg-orange-400/20 text-orange-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate capitalize">{tool.name.toLowerCase()}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{tool.count} usos</span>
                </div>
              ))}
              {topTools.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados disponíveis</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Users Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Ranking de Usuários
            </CardTitle>
            <CardDescription>Usuários que mais utilizam o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRanking.map((user, index) => (
                <div key={user.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                    index === 1 ? "bg-gray-300/30 text-gray-600" :
                    index === 2 ? "bg-orange-400/20 text-orange-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.category}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{user.checkouts} retiradas</span>
                </div>
              ))}
              {userRanking.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados disponíveis</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Delays by Site Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Atraso por Obra</CardTitle>
            <CardDescription>Top 5 obras com maior taxa de atraso</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={delaysBySite}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value, name) => {
                    if (name === "rate") return [`${value}%`, "Taxa de Atraso"];
                    return [value, name === "delays" ? "Atrasos" : "Total"];
                  }}
                />
                <Bar dataKey="rate" fill="hsl(var(--destructive))" name="Taxa (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Delays by User Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Atraso por Usuário</CardTitle>
            <CardDescription>Top 5 usuários com maior taxa de atraso</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={delaysByUser}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value, name) => {
                    if (name === "rate") return [`${value}%`, "Taxa de Atraso"];
                    return [value, name === "delays" ? "Atrasos" : "Total"];
                  }}
                />
                <Bar dataKey="rate" fill="hsl(var(--warning))" name="Taxa (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
