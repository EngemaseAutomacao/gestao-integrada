import { Car, Upload, LogIn, History, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MenuCard } from "@/components/MenuCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileModuleMenu, MobileMenuItem } from "@/components/MobileModuleMenu";


export default function VeiculosMenu() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isMobile = useIsMobile();

  if (true) {
    const items: MobileMenuItem[] = [
      {
        title: "Painel Geral",
        description: "Visão geral da frota",
        icon: <Car className="w-6 h-6" />,
        to: "/veiculos/dashboard",
      },
      {
        title: "Registrar Saída",
        description: "Saída de veículo",
        icon: <Upload className="w-5 h-5" />,
        to: "/veiculos/saida",
      },
      {
        title: "Registrar Devolução",
        description: "Chegada do veículo",
        icon: <LogIn className="w-5 h-5" />,
        to: "/veiculos/chegada",
      },
      {
        title: "Meu Histórico",
        description: "Suas movimentações",
        icon: <History className="w-5 h-5" />,
        to: "/veiculos/historico",
      },
    ];

    const adminItems: MobileMenuItem[] = isAdmin
      ? [
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
        title="Veículos"
        subtitle="Entradas e saídas da frota"
        heroIcon={<Car className="w-5 h-5" />}
        items={items}
        adminItems={adminItems}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden sm:block">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Veículos</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie a entrada e saída de veículos da frota
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MenuCard
          title="Painel Geral"
          description="Visão geral da frota"
          icon={<Car className="w-6 h-6 text-primary" />}
          to="/veiculos/dashboard"
        />
        <MenuCard
          title="Registrar Saída"
          description="Registrar saída de veículo"
          icon={<Upload className="w-6 h-6 text-primary" />}
          to="/veiculos/saida"
        />
        <MenuCard
          title="Registrar Devolução"
          description="Registrar chegada do veículo"
          icon={<LogIn className="w-6 h-6 text-primary" />}
          to="/veiculos/chegada"
        />
        <MenuCard
          title="Meu Histórico"
          description="Suas movimentações de veículos"
          icon={<History className="w-6 h-6 text-primary" />}
          to="/veiculos/historico"
        />
        {isAdmin && (
          <MenuCard
            title="Histórico Geral"
            description="Todas as movimentações"
            icon={<ClipboardList className="w-6 h-6 text-primary" />}
            to="/admin/historico"
          />
        )}
      </div>
    </div>
  );
}
