import { Wrench, Upload, LogIn, History, ClipboardList, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUrgencyBadges } from "@/hooks/useUrgencyBadges";
import { MobileModuleMenu, MobileMenuItem } from "@/components/MobileModuleMenu";

export default function FerramentasMenu() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const { toolOverdue } = useUrgencyBadges();

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
