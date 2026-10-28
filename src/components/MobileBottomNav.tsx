import { NavLink, useLocation } from "react-router-dom";
import { Settings, Menu, LogOut, HelpCircle, FileText, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMobileNavConfig } from "@/hooks/useMobileNavConfig";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function MobileBottomNav() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const { getSelectedTabs } = useMobileNavConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const tabs = getSelectedTabs(isAdmin);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  // Prefetch lazy route chunks on hover/touch for instant navigation
  const prefetchRoute = (path: string) => {
    if (path === "/") import("@/pages/Home");
    else if (path.startsWith("/ferramentas")) import("@/pages/FerramentasMenu");
    else if (path.startsWith("/veiculos")) import("@/pages/VeiculosMenu");
    else if (path.startsWith("/admin")) import("@/pages/admin/AdminDashboard");
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center h-14">
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center h-14" style={{ minWidth: 'max-content' }}>
            {tabs.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onPointerEnter={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-full text-muted-foreground transition-colors min-w-[60px] active:scale-95",
                  tabs.length <= 4 ? "flex-1" : "px-3",
                  isActive(item.path) && "text-primary"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>


        {/* More menu button - always fixed on right */}
        <div className="shrink-0 border-l bg-card">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 h-full text-muted-foreground px-3 min-w-[60px]">
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-2 mt-4">
              <NavLink
                to="/ajuda"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:scale-[0.98] transition-all"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Ajuda</span>
              </NavLink>
              <NavLink
                to="/changelog"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:scale-[0.98] transition-all"
              >
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Notas de Atualização</span>
              </NavLink>
              <NavLink
                to="/change-password"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:scale-[0.98] transition-all"
              >
                <KeyRound className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Alterar Senha</span>
              </NavLink>
              <NavLink
                to="/mobile-settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 active:scale-[0.98] transition-all"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Personalizar Menu</span>
              </NavLink>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive gap-3 px-3"
                onClick={() => { setMenuOpen(false); setLogoutDialogOpen(true); }}
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Sair</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <LogoutConfirmDialog 
        open={logoutDialogOpen} 
        onOpenChange={setLogoutDialogOpen} 
        onConfirm={signOut} 
      />
    </nav>
  );
}
