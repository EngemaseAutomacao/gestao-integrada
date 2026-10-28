import { useSearchParams, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { DashboardSkeleton } from "@/components/PageSkeleton";

const AdminLogs = lazy(() => import("./AdminLogs"));
const AdminAudit = lazy(() => import("./AdminAudit"));

export default function AdminAuditoria() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "auditoria";

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  return (
    <div className="space-y-6">
      <div className="hidden sm:block">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Auditoria & Logs</h2>
        <p className="text-muted-foreground">Registro detalhado de ações e histórico do sistema</p>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="auditoria" className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Logs do Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auditoria" className="mt-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <AdminAudit />
          </Suspense>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <AdminLogs />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
