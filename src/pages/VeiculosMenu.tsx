import { Car, Upload, LogIn, History, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MobileModuleMenu, MobileMenuItem } from "@/components/MobileModuleMenu";

export default function VeiculosMenu() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

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
