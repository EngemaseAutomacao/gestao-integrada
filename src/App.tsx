
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { APP_VERSION } from "@/version";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardSkeleton as PageSkeleton } from "@/components/PageSkeleton";
import UpdatePrompt from "./components/UpdatePrompt";
import { ChangelogModal } from "./components/ChangelogModal";
import { OnboardingTutorial } from "./components/OnboardingTutorial";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const Register = lazy(() => import("./pages/Register"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Home = lazy(() => import("./pages/Home"));
const FerramentasMenu = lazy(() => import("./pages/FerramentasMenu"));
const VeiculosMenu = lazy(() => import("./pages/VeiculosMenu"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ToolDetail = lazy(() => import("./pages/ToolDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Checkin = lazy(() => import("./pages/Checkin"));
const VehicleDashboard = lazy(() => import("./pages/vehicles/VehicleDashboard"));
const VehicleCheckout = lazy(() => import("./pages/vehicles/VehicleCheckout"));
const VehicleCheckin = lazy(() => import("./pages/vehicles/VehicleCheckin"));
const VehicleDetail = lazy(() => import("./pages/vehicles/VehicleDetail"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
// AdminTools removed - integrated into AdminConstructionSites
// AdminHistory removed - unused (replaced by AdminHistorico)
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));

// AdminIssues removed - unused (replaced by AdminProblemas)
const AdminConstructionSites = lazy(() => import("./pages/admin/AdminConstructionSites"));
const AdminGallery = lazy(() => import("./pages/admin/AdminGallery"));
const AdminDataRetention = lazy(() => import("./pages/admin/AdminDataRetention"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
// AdminVehicleHistory removed - unused
// ReportIssue, ReportVehicleIssue, AdminProblemas removidos — módulo descontinuado
const AdminAuditoria = lazy(() => import("./pages/admin/AdminAuditoria"));
const AdminHistorico = lazy(() => import("./pages/admin/AdminHistorico"));
const AdminAnalyticsHub = lazy(() => import("./pages/admin/AdminAnalyticsHub"));
const AdminToolsInUse = lazy(() => import("./pages/admin/AdminToolsInUse"));
const AdminUserAccess = lazy(() => import("./pages/admin/AdminUserAccess"));
const AdminVehiclesInUse = lazy(() => import("./pages/admin/AdminVehiclesInUse"));
// AdminSiteTools removed

const DevolucoesPendentes = lazy(() => import("./pages/DevolucoesPendentes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Help = lazy(() => import("./pages/Help"));
const Changelog = lazy(() => import("./pages/Changelog"));
const MobileNavSettings = lazy(() => import("./pages/MobileNavSettings"));
const Historico = lazy(() => import("./pages/Historico"));
const Pendencias = lazy(() => import("./pages/Pendencias"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const msg = getFriendlyErrorMessage(error);
      if (typeof window !== "undefined") {
        import("sonner").then(({ toast }) => toast.error(msg));
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const msg = getFriendlyErrorMessage(error);
      if (typeof window !== "undefined") {
        import("sonner").then(({ toast }) => toast.error(msg));
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },

  },
});

const queryPersister = typeof window !== "undefined"
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: "engemase_rq_cache",
      throttleTime: 1500,
    })
  : undefined;

const App = () => (
  <ErrorBoundary>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister!,
        maxAge: 24 * 60 * 60 * 1000,
        buster: APP_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
    >
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          
          <Sonner />
          <UpdatePrompt />
          <BrowserRouter>
            <OfflineProvider>
              <AuthProvider>
                <ChangelogModal />
                <OnboardingTutorial />
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-[40vh]">
                    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                }>
                  <Routes>
                    {/* Public routes (no Layout) */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/change-password" element={<ChangePassword />} />

                    {/* Authenticated routes share a single Layout instance (no remount on navigation) */}
                    <Route element={<Layout><Outlet /></Layout>}>
                      <Route path="/" element={<Home />} />
                      {/* Ferramentas Routes */}
                      <Route path="/ferramentas" element={<Navigate to="/ferramentas/dashboard" replace />} />
                      <Route path="/ferramentas/dashboard" element={<Dashboard />} />
                      <Route path="/ferramentas/lista" element={<Navigate to="/ferramentas/dashboard" replace />} />
                      <Route path="/ferramentas/:id" element={<ToolDetail />} />
                      <Route path="/ferramentas/retirada" element={<Checkout />} />
                      <Route path="/ferramentas/devolucao" element={<Checkin />} />
                      <Route path="/ferramentas/historico" element={<Navigate to="/historico?tipo=tool" replace />} />
                      <Route path="/ferramentas/menu" element={<FerramentasMenu />} />
                      {/* Veículos Routes */}
                      <Route path="/veiculos" element={<Navigate to="/veiculos/dashboard" replace />} />
                      <Route path="/veiculos/dashboard" element={<VehicleDashboard />} />
                      <Route path="/veiculos/lista" element={<Navigate to="/veiculos/dashboard" replace />} />
                      <Route path="/veiculos/:id" element={<VehicleDetail />} />
                      <Route path="/veiculos/saida" element={<VehicleCheckout />} />
                      <Route path="/veiculos/chegada" element={<VehicleCheckin />} />
                      <Route path="/veiculos/historico" element={<Navigate to="/historico?tipo=vehicle" replace />} />
                      <Route path="/veiculos/menu" element={<VeiculosMenu />} />
                      <Route path="/veiculos/combustivel" element={<Navigate to="/veiculos/dashboard" replace />} />
                      <Route path="/veiculos/analytics" element={<Navigate to="/veiculos/dashboard" replace />} />
                      <Route path="/admin/vehicle-history" element={<Navigate to="/admin/historico?tab=veiculos" replace />} />
                      <Route path="/admin/vehicle-issues" element={<Navigate to="/admin" replace />} />
                      <Route path="/veiculos/report-issue" element={<Navigate to="/veiculos" replace />} />
                      {/* Legacy routes - redirect to new paths */}
                      <Route path="/tools" element={<Navigate to="/ferramentas/lista" replace />} />
                      <Route path="/tools/:id" element={<ToolDetail />} />
                      <Route path="/checkout" element={<Navigate to="/ferramentas/retirada" replace />} />
                      <Route path="/checkin" element={<Navigate to="/ferramentas/devolucao" replace />} />
                      <Route path="/history" element={<Navigate to="/ferramentas/historico" replace />} />
                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/tools" element={<Navigate to="/admin/construction-sites?tab=ferramentas" replace />} />
                      <Route path="/admin/history" element={<Navigate to="/admin/historico?tab=ferramentas" replace />} />
                      <Route path="/admin/historico" element={<AdminHistorico />} />
                      <Route path="/admin/logs" element={<Navigate to="/admin/auditoria?tab=logs" replace />} />
                      <Route path="/admin/analytics" element={<Navigate to="/admin/analytics-hub?tab=ferramentas" replace />} />
                      <Route path="/admin/analytics-hub" element={<AdminAnalyticsHub />} />
                      <Route path="/admin/notifications" element={<AdminNotifications />} />
                      <Route path="/admin/maintenance" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin/reports" element={<AdminReports />} />
                      <Route path="/admin/manual" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin/issues" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin/problemas" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin/construction-sites" element={<AdminConstructionSites />} />
                      <Route path="/admin/gallery" element={<AdminGallery />} />
                      <Route path="/admin/data-retention" element={<AdminDataRetention />} />
                      <Route path="/admin/audit" element={<Navigate to="/admin/auditoria?tab=auditoria" replace />} />
                      <Route path="/admin/auditoria" element={<AdminAuditoria />} />
                      <Route path="/admin/ferramentas-em-uso" element={<AdminToolsInUse />} />
                      <Route path="/admin/veiculos-em-uso" element={<AdminVehiclesInUse />} />
                      <Route path="/admin/ultimos-acessos" element={<AdminUserAccess />} />

                      {/* Ponto Online & Transferências removidos — redirect para Home */}
                      <Route path="/ponto" element={<Navigate to="/" replace />} />
                      <Route path="/ponto/registrar" element={<Navigate to="/" replace />} />
                      <Route path="/ponto/historico" element={<Navigate to="/historico" replace />} />
                      <Route path="/ponto/admin" element={<Navigate to="/" replace />} />
                      <Route path="/transferencias" element={<Navigate to="/" replace />} />
                      <Route path="/meu-dia" element={<Navigate to="/historico" replace />} />
                      <Route path="/historico" element={<Historico />} />
                      <Route path="/pendencias" element={<Pendencias />} />
                      <Route path="/devolucoes-pendentes" element={<DevolucoesPendentes />} />
                      <Route path="/report-issue" element={<Navigate to="/" replace />} />
                      <Route path="/changelog" element={<Changelog />} />
                      <Route path="/mobile-settings" element={<MobileNavSettings />} />
                      <Route path="/ajuda" element={<Help />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </OfflineProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </ErrorBoundary>
);

export default App;
