import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Wrench,
  Car,
  Clock,
  Package,
  Shield,
  Upload,
  LogIn,
  History,
  Settings,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Users,
  FileText,
  Bell,
  Fuel,
  ArrowRightLeft,
  CalendarDays,
  Building2,
  Database,
  Image as ImageIcon,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUrgencyBadges } from "@/hooks/useUrgencyBadges";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import engemaseLogo from "@/assets/engemase-logo.png";

type Item = {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: number;
};

type Group = {
  label: string;
  items: Item[];
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { toolBadgeCount, vehicleBadgeCount } = useUrgencyBadges();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const groups: Group[] = [
    {
      label: "Principal",
      items: [
        { title: "Início", url: "/", icon: Home },
        { title: "Meu Histórico", url: "/historico", icon: History },
        { title: "Histórico Geral", url: "/admin/historico", icon: ClipboardList },
      ],
    },

    {
      label: "Ferramentas",
      items: [
        { title: "Painel & Catálogo", url: "/ferramentas/dashboard", icon: Package, badge: toolBadgeCount },
      ],
    },
    {
      label: "Veículos",
      items: [
        { title: "Painel & Catálogo", url: "/veiculos/dashboard", icon: Package, badge: vehicleBadgeCount },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: "Administração",
            items: [
              { title: "Dashboard", url: "/admin", icon: Shield },
              { title: "Usuários", url: "/admin/users", icon: Users },
              
              { title: "Obras e Clientes", url: "/admin/construction-sites", icon: Building2 },
              { title: "Analytics", url: "/admin/analytics-hub", icon: BarChart3 },
              { title: "Relatórios", url: "/admin/reports", icon: FileText },
              { title: "Notificações", url: "/admin/notifications", icon: Bell },
              { title: "Galeria", url: "/admin/gallery", icon: ImageIcon },
              { title: "Auditoria & Logs", url: "/admin/auditoria", icon: ShieldCheck },
              { title: "Retenção de Dados", url: "/admin/data-retention", icon: Database },
              
            ],
          },
        ]
      : []),
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r"
      aria-label="Navegação principal"
    >
      <SidebarHeader className="border-b">
        <NavLink
          to="/"
          className={cn(
            "flex items-center gap-2 px-2 py-2 rounded-md transition-all duration-200",
            "hover:bg-sidebar-accent hover:scale-[1.02]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1",
            collapsed && "justify-center px-0"
          )}
          aria-label="Ir para a página inicial"
        >
          <img
            src={engemaseLogo}
            alt=""
            aria-hidden="true"
            className="h-7 w-auto shrink-0"
          />
          {!collapsed && (
            <span className="text-sm font-semibold truncate">Engemase</span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  const hasBadge = !!(item.badge && item.badge > 0);
                  const badgeLabel = hasBadge
                    ? `, ${item.badge} ${item.badge === 1 ? "pendente" : "pendentes"}`
                    : "";
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={
                          collapsed
                            ? hasBadge
                              ? `${item.title} (${item.badge})`
                              : item.title
                            : undefined
                        }
                        className={cn(
                          "transition-colors duration-150",
                          "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1"
                        )}
                      >
                        <NavLink
                          to={item.url}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-md",
                            active && "font-medium"
                          )}
                          aria-current={active ? "page" : undefined}
                          aria-label={`${item.title}${badgeLabel}`}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-150",
                              active && "scale-110"
                            )}
                            aria-hidden="true"
                          />
                          {!collapsed && (
                            <span className="flex-1 truncate">{item.title}</span>
                          )}
                          {!collapsed && hasBadge ? (
                            <Badge
                              variant="destructive"
                              className="h-5 min-w-5 px-1.5 text-[10px] font-semibold animate-fade-in"
                              aria-hidden="true"
                            >
                              {item.badge! > 99 ? "99+" : item.badge}
                            </Badge>
                          ) : null}
                          {collapsed && hasBadge ? (
                            <span
                              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar"
                              aria-hidden="true"
                            />
                          ) : null}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
