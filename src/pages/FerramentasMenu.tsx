import { Wrench, Upload, LogIn, History, ClipboardList, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUrgencyBadges } from "@/hooks/useUrgencyBadges";
import { MenuCard } from "@/components/MenuCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileModuleMenu, MobileMenuItem } from "@/components/MobileModuleMenu";


export default function FerramentasMenu() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isMobile = useIsMobile();

  const { toolOverdue } = useUrgencyBadges();

  if (true) {
    const items: MobileMenuItem[] = [
      {
        title: "Painel Geral",
        description: "Visão geral e status das ferramentas",
        icon: <Wrench className="w-6 h-6" />,
        to: "/ferramentas/dashboard",
      },
      {
        title: "Registrar Saída",
        description: "Retirar uma ferramenta",
        icon: <Upload className="w-5 h-5" />,
        to: "/ferramentas/retirada",
      },
      {
        title: "Registrar Devolução",
        description: "Devolver uma ferramenta",
        icon: <LogIn className="w-5 h-5" />,
        to: "/ferramentas/devolucao",
        badgeCount: toolOverdue,
      },
      {
        title: "Meu Histórico",
        description: "Suas movimentações",
        icon: <History className="w-5 h-5" />,
        to: "/ferramentas/historico",
      },
    ];

    const adminItems: MobileMenuItem[] = isAdmin
      ? [
          {
            title: "Sincronizações",
            description: "Obras, clientes e ferramentas",
            icon: <Settings className="w-5 h-5" />,
            to: "/admin/construction-sites",
          },
          {
            title: "Histórico Geral",
            description: "Todas movimentações",
            icon: <ClipboardList className="w-5 h-5" />,
            to: "/admin/historico",
          },
        ]
      : [];

    return (
      <MobileModuleMenu
        eyebrow="Módulo"
        title="Ferramentas"
        subtitle="Retiradas, devoluções e manutenções"
        heroIcon={<Wrench className="w-5 h-5" />}
        items={items}
        adminItems={adminItems}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden sm:block">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Ferramentas</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie retiradas, devoluções e manutenções de ferramentas
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MenuCard
          title="Painel Geral"
          description="Visão geral e status das ferramentas"
          icon={<Wrench className="w-6 h-6 text-primary" />}
          to="/ferramentas/dashboard"
        />
        <MenuCard
          title="Registrar Saída"
          description="Retirar uma ferramenta"
          icon={<Upload className="w-6 h-6 text-primary" />}
          to="/ferramentas/retirada"
        />
        <MenuCard
          title="Registrar Devolução"
          description="Devolver uma ferramenta"
          icon={<LogIn className="w-6 h-6 text-primary" />}
          to="/ferramentas/devolucao"
          badgeCount={toolOverdue}
        />
        <MenuCard
          title="Meu Histórico"
          description="Suas movimentações de ferramentas"
          icon={<History className="w-6 h-6 text-primary" />}
          to="/ferramentas/historico"
        />
        {isAdmin && (
          <>
            <MenuCard
              title="Sincronizações"
              description="Obras, clientes e ferramentas"
              icon={<Settings className="w-6 h-6 text-primary" />}
              to="/admin/construction-sites"
            />
            <MenuCard
              title="Histórico Geral"
              description="Todas as movimentações"
              icon={<ClipboardList className="w-6 h-6 text-primary" />}
              to="/admin/historico"
            />
          </>
        )}
      </div>
    </div>
  );
}
