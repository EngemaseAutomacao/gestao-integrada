import { Card } from "@/components/ui/card";
import { Users, BarChart3, FileText, Bell, ClipboardList, Images, Building2, Database, Shield, ChevronRight, Wrench, Clock, Car } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ModuleHero } from "@/components/ModuleHero";

interface AdminItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}

interface AdminSection {
  label: string;
  items: AdminItem[];
}

function AdminCard({ title, description, icon, to }: AdminItem) {
  return (
    <Link to={to} className="block group">
      <Card className="relative h-full p-3 sm:p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{title}</h3>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();

  if (profile?.role !== "admin") {
    return <Navigate to="/" />;
  }

  const sections: AdminSection[] = [
    {
      label: "Operação",
      items: [
        { title: "Usuários", description: "Gerenciar contas e permissões", icon: <Users className="w-5 h-5" />, to: "/admin/users" },
        { title: "Ferramentas em Uso", description: "Ver quem está com cada ferramenta e devolver", icon: <Wrench className="w-5 h-5" />, to: "/admin/ferramentas-em-uso" },
        { title: "Veículos em Uso", description: "Ver quem está com cada veículo e devolver", icon: <Car className="w-5 h-5" />, to: "/admin/veiculos-em-uso" },
        { title: "Últimos Acessos", description: "Há quantos dias cada usuário não entra", icon: <Clock className="w-5 h-5" />, to: "/admin/ultimos-acessos" },
        { title: "Gestão Administrativa", description: "Obras, clientes e ferramentas", icon: <Building2 className="w-5 h-5" />, to: "/admin/construction-sites" },
        { title: "Notificações", description: "Configurar alertas do sistema", icon: <Bell className="w-5 h-5" />, to: "/admin/notifications" },
      ],
    },
    {
      label: "Insights",
      items: [
        { title: "Analytics", description: "Ferramentas e veículos", icon: <BarChart3 className="w-5 h-5" />, to: "/admin/analytics-hub" },
        { title: "Histórico Geral", description: "Movimentações consolidadas", icon: <ClipboardList className="w-5 h-5" />, to: "/admin/historico" },
        { title: "Relatórios", description: "Gerar e exportar relatórios", icon: <FileText className="w-5 h-5" />, to: "/admin/reports" },
        
        { title: "Galeria de Imagens", description: "Fotos do sistema", icon: <Images className="w-5 h-5" />, to: "/admin/gallery" },
      ],
    },
    {
      label: "Segurança & Dados",
      items: [
        { title: "Auditoria & Logs", description: "Registro detalhado de ações", icon: <Shield className="w-5 h-5" />, to: "/admin/auditoria" },
        { title: "Retenção de Dados", description: "Controle de limpeza automática", icon: <Database className="w-5 h-5" />, to: "/admin/data-retention" },
      ],
    },
  ];

  return (
    <div className="animate-fade-in">
      <ModuleHero
        eyebrow="Módulo · Administração"
        title="Painel Administrativo"
        subtitle="Gerencie usuários, dados e configurações do sistema"
      />
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-4 space-y-5">
        {sections.map((section) => (
          <section key={section.label} aria-label={section.label} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {section.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {section.items.map((item) => (
                <AdminCard key={item.title} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
