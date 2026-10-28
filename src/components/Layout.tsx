import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation, NavLink, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { 
  Home, 
  Package, 
  History, 
  Users, 
  Settings, 
  LogOut, 
  Wrench, 
  ClipboardList, 
  BarChart3, 
  Bell, 
  FileText, 
  AlertCircle, 
  Car, 
  ChevronDown,
  ArrowLeft,
  Fuel,
  MapPin,
  HelpCircle,
  KeyRound,
  LogIn,
  Upload,
  ArrowRightLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";

import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SyncQueuePanel } from "@/components/SyncQueuePanel";
import { ThemeToggle } from "@/components/ThemeToggle";

import { Footer } from "@/components/Footer";
import { PermissionsRequest } from "@/components/PermissionsRequest";
import { useAppBadge } from "@/hooks/useAppBadge";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CommandPalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import engemaseLogo from "@/assets/engemase-logo.png";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, Suspense } from "react";
import { DashboardSkeleton as PageSkeleton } from "@/components/PageSkeleton";
import { prefetchMainRoutes } from "@/lib/prefetchRoutes";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

// Route-to-title mapping as module-level constant (avoids re-creation on every render)
const routeTitleMap: Record<string, { title: string; icon: typeof Wrench }> = {
  '/ferramentas': { title: 'Ferramentas', icon: Wrench },
  '/ferramentas/dashboard': { title: 'Painel Geral', icon: Wrench },
  '/ferramentas/lista': { title: 'Catálogo', icon: Package },
  '/ferramentas/retirada': { title: 'Registrar Saída', icon: Upload },
  '/ferramentas/devolucao': { title: 'Registrar Devolução', icon: LogIn },
  '/ferramentas/historico': { title: 'Meu Histórico', icon: History },
  '/checkout': { title: 'Registrar Saída', icon: Upload },
  '/checkin': { title: 'Registrar Devolução', icon: LogIn },
  '/history': { title: 'Meu Histórico', icon: History },
  '/report-issue': { title: 'Reportar Problema', icon: AlertCircle },
  '/veiculos': { title: 'Veículos', icon: Car },
  '/veiculos/dashboard': { title: 'Painel Geral', icon: Car },
  '/veiculos/lista': { title: 'Lista de Veículos', icon: Package },
  '/veiculos/saida': { title: 'Registrar Saída', icon: Upload },
  '/veiculos/chegada': { title: 'Registrar Devolução', icon: LogIn },
  '/veiculos/historico': { title: 'Meu Histórico', icon: History },
  '/admin': { title: 'Administração', icon: Settings },
  '/admin/users': { title: 'Usuários', icon: Users },
  '/admin/tools': { title: 'Gestão Administrativa', icon: Settings },
  '/admin/maintenance': { title: 'Manutenções', icon: Wrench },
  
  '/admin/history': { title: 'Histórico Geral', icon: ClipboardList },
  '/admin/analytics': { title: 'Analytics', icon: BarChart3 },
  '/admin/reports': { title: 'Relatórios', icon: FileText },
  '/admin/notifications': { title: 'Notificações', icon: Bell },
  '/admin/logs': { title: 'Logs', icon: ClipboardList },
  '/admin/manual': { title: 'Entrada Manual', icon: Settings },
  '/admin/gallery': { title: 'Galeria', icon: Package },
  '/admin/vehicle-history': { title: 'Histórico Geral de Veículos', icon: ClipboardList },
  
  '/historico': { title: 'Meu Histórico', icon: History },
  '/devolucoes-pendentes': { title: 'Devoluções Pendentes', icon: History },
  '/ajuda': { title: 'Ajuda', icon: HelpCircle },
  '/changelog': { title: 'Notas de Atualização', icon: FileText },
  '/change-password': { title: 'Alterar Senha', icon: Settings },
  '/mobile-settings': { title: 'Menu Mobile', icon: Settings },
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  useAppBadge();
  useEffect(() => { prefetchMainRoutes(); }, []);
  

  
  
  const isHomePage = location.pathname === '/';
  const adminToolRoutes = ['/admin/construction-sites?tab=ferramentas', '/admin/maintenance', '/admin/history'];
  const isAdminToolRoute = adminToolRoutes.some(r => location.pathname.startsWith(r));
  const isFerramentasModule = location.pathname.startsWith('/ferramentas') || 
                               location.pathname.startsWith('/tools') ||
                               location.pathname.startsWith('/checkout') ||
                               location.pathname.startsWith('/checkin') ||
                               location.pathname.startsWith('/history') ||
                               location.pathname.startsWith('/report-issue') ||
                               isAdminToolRoute;
  const isAdminVehicleRoute = location.pathname === '/admin/vehicle-history';
  const isVeiculosModule = location.pathname.startsWith('/veiculos') || isAdminVehicleRoute;
  const isAdminModule = location.pathname.startsWith('/admin') && !isAdminToolRoute && !isAdminVehicleRoute;

  const isAdmin = profile?.role === "admin";

  const ferramentasMenuItems = [
    { title: "Menu", url: "/ferramentas", icon: Wrench },
    { title: "Painel Geral", url: "/ferramentas/dashboard", icon: Package },
    { title: "Catálogo", url: "/ferramentas/lista", icon: Package },
    { title: "Meu Histórico", url: "/ferramentas/historico", icon: History },
    ...(isAdmin ? [
      { title: "Gerenciar Ferramentas", url: "/admin/construction-sites?tab=ferramentas", icon: Settings },
      { title: "Manutenções", url: "/admin/maintenance", icon: Wrench },
      
      { title: "Histórico Geral", url: "/admin/history", icon: ClipboardList },
    ] : []),
  ];

  const veiculosMenuItems = [
    { title: "Menu", url: "/veiculos", icon: Car },
    { title: "Painel Geral", url: "/veiculos/dashboard", icon: Car },
    { title: "Lista de Veículos", url: "/veiculos/lista", icon: Package },
    { title: "Meu Histórico", url: "/veiculos/historico", icon: History },
    ...(isAdmin ? [
      
      { title: "Histórico Geral", url: "/admin/vehicle-history", icon: ClipboardList },
    ] : []),
  ];

  const adminMenuItems = [
    { title: "Dashboard", url: "/admin", icon: BarChart3 },
    { title: "Usuários", url: "/admin/users", icon: Users },
    { title: "Analytics Geral", url: "/admin/analytics", icon: BarChart3 },
    
    { title: "Relatórios", url: "/admin/reports", icon: FileText },
    
    { title: "Notificações", url: "/admin/notifications", icon: Bell },
    { title: "Logs", url: "/admin/logs", icon: ClipboardList },
    
  ];

  

  const getMobilePageTitle = () => {
    // Try exact match first
    const exact = routeTitleMap[location.pathname];
    if (exact) return exact;
    // Fallback to module title
    return null;
  };

  const getCurrentModuleInfo = () => {
    if (isFerramentasModule) {
      return { 
        title: "Ferramentas", 
        icon: Wrench, 
        items: ferramentasMenuItems,
        color: "text-primary"
      };
    }
    if (isVeiculosModule) {
      return { 
        title: "Veículos", 
        icon: Car, 
        items: veiculosMenuItems,
        color: "text-primary"
      };
    }
    if (isAdminModule && isAdmin) {
      return { 
        title: "Administração", 
        icon: Settings, 
        items: adminMenuItems,
        color: "text-primary"
      };
    }
    return null;
  };

  const currentModule = getCurrentModuleInfo();

  const isActiveRoute = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname === url || location.pathname.startsWith(url + "/");
  };

  // Hide splash screen when auth is done loading (respect min display time)
  if (!loading) {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.dataset.hiding) {
      splash.dataset.hiding = '1';
      const MIN_MS = 1800;
      const elapsed = Date.now() - ((window as any).__SPLASH_START__ || Date.now());
      const wait = Math.max(0, MIN_MS - elapsed);
      setTimeout(() => {
        splash.classList.add('splash-out');
        setTimeout(() => splash.remove(), 450);
      }, wait);
    }
  }

  if (loading) {
    return null; // Keep HTML splash visible
  }

  if (!user || !profile) {
    return <Navigate to="/auth" />;
  }

  if (profile.first_login) {
    return <Navigate to="/change-password" />;
  }

  if (!profile.approved) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="text-center space-y-4 max-w-md bg-card p-8 rounded-xl shadow-lg border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Aguardando Aprovação</h1>
          <p className="text-muted-foreground">
            Sua conta foi criada com sucesso, mas ainda não foi aprovada por um administrador.
            Por favor, aguarde a aprovação para acessar o sistema.
          </p>
          <Button variant="ghost" onClick={signOut} className="text-primary">
            Sair e tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex w-full bg-background overflow-hidden">
      <PermissionsRequest />
      <CommandPalette />
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
      {/* Header */}
      <header className="h-12 sm:h-14 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40 px-2 sm:px-4 md:px-6">
        <div className="h-full max-w-6xl mx-auto w-full flex items-center justify-between relative">
        <div className={cn("flex items-center gap-1.5 sm:gap-3", isMobile && "min-w-[40px]")}>
          {/* Mobile: Theme toggle only on home page */}
          {isMobile && isHomePage && <ThemeToggle />}




          {/* Logo - desktop always, mobile only on non-home pages hidden (title takes center) */}
          {!isMobile && (
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <img src={engemaseLogo} alt="Engemase Engenharia logotipo" className="h-7 sm:h-8 w-auto" />
            </NavLink>
          )}

          {/* Desktop: Back button (goes to previous page) */}
          {!isHomePage && !isMobile && (
            <>
              <div className="h-5 w-px bg-border hidden sm:block" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate("/");
                  }
                }}
                className="gap-1 text-muted-foreground hover:text-foreground h-8 px-2"
                aria-label="Voltar para a página anterior"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Voltar</span>
              </Button>
            </>
          )}
        </div>

        {/* Desktop: Centered search bar */}
        {!isMobile && (
          <div className="absolute left-1/2 -translate-x-1/2 z-30">
            <GlobalSearch />
          </div>
        )}

        {/* Mobile: Centered page title */}
        {isMobile && (() => {
          if (isHomePage) {
            return (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                <img src={engemaseLogo} alt="Engemase Engenharia logotipo" className="h-7 w-auto" />
              </div>
            );
          }
          const pageTitle = getMobilePageTitle();
          const icon = pageTitle?.icon || currentModule?.icon;
          const title = pageTitle?.title || currentModule?.title;
          const IconComponent = icon;
          if (!title) return null;
          return (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 max-w-[55%] px-2">
              {IconComponent && <IconComponent className="w-4 h-4 text-primary shrink-0" />}
              <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            </div>
          );

        })()}

        {/* Right side */}
        <div className={cn("flex items-center gap-1 sm:gap-2", isMobile && "min-w-[100px] justify-end")}>
          
          <SyncQueuePanel />
          <OfflineIndicator />
          
          {!isMobile && <ThemeToggle />}
          {!isMobile && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/ajuda')} aria-label="Ajuda">
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Ajuda</span>
            </Button>
          )}
          <NotificationBell />
          

          
          {/* User dropdown - hidden on mobile (signout is in bottom nav menu) */}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 max-w-[140px] sm:max-w-[180px] h-8 px-2">
                  <span className="text-xs font-medium truncate hidden sm:inline">
                    {profile?.full_name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border shadow-lg z-50">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "w-fit text-xs mt-1",
                        profile?.category === "engemase_employee" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-orange-500/10 text-orange-500"
                      )}
                    >
                      {profile?.category === "engemase_employee" ? "Funcionário" : "Terceirizado"}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate('/change-password')}
                  className="cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLogoutDialogOpen(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn("flex-1 min-h-0 overflow-auto p-3 sm:p-4 md:p-6", isMobile && "pb-20")}>
        <Suspense key={location.pathname} fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </main>

      {/* Footer - hidden on mobile */}
      {!isMobile && <Footer />}

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}

      {/* Logout Confirmation */}
      <LogoutConfirmDialog 
        open={logoutDialogOpen} 
        onOpenChange={setLogoutDialogOpen} 
        onConfirm={signOut} 
      />
        </div>
      </div>
  );
}

