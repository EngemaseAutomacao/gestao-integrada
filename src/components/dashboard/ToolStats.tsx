import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Tool {
  quantity_available: number;
  quantity_total: number;
}

interface ToolStatsProps {
  tools: Tool[];
}

export function ToolStats({ tools }: ToolStatsProps) {
  const available = tools.reduce((acc, t) => acc + t.quantity_available, 0);
  const total = tools.reduce((acc, t) => acc + t.quantity_total, 0);
  const inUse = tools.reduce((acc, t) => acc + (t.quantity_total - t.quantity_available), 0);

  return (
    <div className="grid gap-2 sm:gap-4 grid-cols-3">
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-xl sm:text-2xl font-bold text-success">{available}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-xl sm:text-2xl font-bold">{total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Em Uso</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-xl sm:text-2xl font-bold text-warning">{inUse}</div>
        </CardContent>
      </Card>
    </div>
  );
}
