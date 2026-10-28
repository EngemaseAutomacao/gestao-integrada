import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Car, Shield, Download, Loader2, Share, History, ChevronRight, Clock, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUrgencyBadges } from "@/hooks/useUrgencyBadges";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useHomePendingCount } from "@/hooks/useHomePendingCount";


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt(isIOS: boolean) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isIOS) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isIOS]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setDeferredPrompt(null);
    }
  };

  return { deferredPrompt, handleInstall };
}

function InstallPWACard({ isIOS }: { isIOS: boolean }) {
  const { deferredPrompt, handleInstall } = useInstallPrompt(isIOS);

  if (isIOS) {
    return (
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg border-dashed border-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-accent/20">
            <Share className="w-6 h-6 text-accent-foreground" />
          </div>
          <CardTitle className="text-base">Instalar App</CardTitle>
        </CardHeader>
        <CardContent className="text-center pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Toque em <strong>Compartilhar</strong> <Share className="w-3 h-3 inline" /> e depois em <strong>"Adicionar à Tela de Início"</strong>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <Card
      className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer hover:border-primary border-dashed border-2"
      onClick={handleInstall}
    >
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-accent/20">
          <Download className="w-6 h-6 text-accent-foreground" />
        </div>
        <CardTitle className="text-base">Instalar App</CardTitle>
      </CardHeader>
      <CardContent className="text-center pt-0">
        <span className="text-sm font-medium text-primary">Instalar →</span>
      </CardContent>
    </Card>
  );
}

function InstallPWAHeroButton({ isIOS }: { isIOS: boolean }) {
  const { deferredPrompt, handleInstall } = useInstallPrompt(isIOS);
  const [showIOSHint, setShowIOSHint] = useState(false);

  if (!isIOS && !deferredPrompt) return null;

  if (isIOS) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIOSHint((v) => !v)}
          className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-white/20 transition-all"
          aria-label="Como instalar o app"
        >
          <Share className="w-4 h-4" />
          <span>Instalar app</span>
        </button>
        {showIOSHint && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-card text-card-foreground border shadow-elevated p-3 text-xs leading-relaxed z-20">
            Toque em <strong>Compartilhar</strong> <Share className="w-3 h-3 inline" /> e depois em <strong>"Adicionar à Tela de Início"</strong>.
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-white/20 hover:scale-[1.02] transition-all"
      aria-label="Instalar aplicativo"
    >
      <Download className="w-4 h-4" />
      <span>Instalar app</span>
      <span className="opacity-70 group-hover:translate-x-0.5 transition-transform">→</span>
    </button>
  );
}


interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to?: string;
  disabled?: boolean;
  comingSoon?: boolean;
  variant?: "default" | "admin";
  badgeCount?: number;
  pendingCount?: number;
  overdueCount?: number;
}

function ModuleCard({
  title,
  description,
  icon,
  to,
  disabled,
  comingSoon,
  variant = "default",
  badgeCount,
  pendingCount,
  overdueCount,
}: ModuleCardProps) {
  const isAdmin = variant === "admin";
  const urgentCount = overdueCount || badgeCount || 0;

  const statusBadge = (() => {
    if (comingSoon) {
      return { label: "Em Breve", className: "bg-muted text-muted-foreground" };
    }
    if (urgentCount > 0) {
      return {
        label: `${urgentCount} Urgente${urgentCount > 1 ? "s" : ""}`,
        className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
      };
    }
    if (pendingCount && pendingCount > 0) {
      return {
        label: `${pendingCount} Pendente${pendingCount > 1 ? "s" : ""}`,
        className: "bg-warning/10 text-warning dark:bg-warning/20",
      };
    }
    if (!disabled) {
      return { label: "Ativo", className: "bg-success/10 text-success dark:bg-success/20" };
    }
    return null;
  })();

  const content = (
    <Card
      className={`group relative h-full overflow-hidden border transition-all duration-300 ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer hover:-translate-y-1 hover:shadow-elevated hover:border-primary/60"
      } ${isAdmin ? "border-warning/40 bg-warning/5" : "bg-card"}`}
    >
      <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div
            className={`p-3 rounded-lg transition-colors ${
              isAdmin
                ? "bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground"
                : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
            }`}
          >
            {icon}
          </div>
          {statusBadge && (
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          )}
        </div>

        <h3 className="font-display text-lg font-bold leading-tight mb-1 text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>

        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {disabled
              ? "Indisponível"
              : isAdmin
              ? "Painel administrativo"
              : "Abrir módulo"}
          </span>
          {!disabled && (
            <span
              className={`font-semibold transition-transform group-hover:translate-x-0.5 ${
                isAdmin ? "text-warning" : "text-primary"
              }`}
            >
              Acessar →
            </span>
          )}
        </div>
      </div>
    </Card>
  );

  if (disabled || !to) {
    return content;
  }

  return (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  );
}

function FeaturedTile({
  title,
  description,
  icon,
  to,
  disabled,
  badgeCount,
  pendingCount,
  overdueCount,
}: ModuleCardProps) {
  const urgent = (overdueCount || 0) + (badgeCount || 0);
  const pending = pendingCount || 0;

  const body = (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 active:scale-[0.99] transition-all shadow-soft">
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-primary/10" />
      <div className="relative flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-base">{title}</h3>
            {urgent > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {urgent} urgente{urgent > 1 ? "s" : ""}
              </span>
            )}
            {urgent === 0 && pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold">
                {pending} pendente{pending > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{description}</p>
          <span className="text-[11px] font-semibold text-primary mt-1 inline-block">Abrir agora →</span>
        </div>
      </div>
    </div>
  );

  if (disabled || !to) return body;
  return <Link to={to} className="block">{body}</Link>;
}

function CompactTile({
  title,
  description,
  icon,
  to,
  disabled,
  comingSoon,
  badgeCount,
  pendingCount,
  overdueCount,
}: ModuleCardProps) {
  const urgent = (overdueCount || 0) + (badgeCount || 0);
  const pending = pendingCount || 0;
  const hasBadge = urgent > 0 || pending > 0;

  const body = (
    <div
      className={`relative h-full rounded-2xl border bg-card p-3.5 active:scale-[0.97] transition-all ${
        disabled ? "opacity-60" : "hover:border-primary/60 hover:shadow-soft"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        {hasBadge && (
          <span
            className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              urgent > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-warning text-warning-foreground"
            }`}
          >
            {urgent > 0 ? urgent : pending}
          </span>
        )}
        {comingSoon && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Em Breve
          </span>
        )}
      </div>
      <h3 className="font-display font-semibold text-sm leading-tight">{title}</h3>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
    </div>
  );

  if (disabled || !to) return body;
  return <Link to={to} className="block h-full">{body}</Link>;
}

function AdminBanner({ title, description, icon, to }: ModuleCardProps) {
  const body = (
    <div className="relative overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-r from-warning/15 via-warning/10 to-transparent p-4 active:scale-[0.99] transition-all">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-warning text-warning-foreground flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-warning font-bold">Painel</p>
          <h3 className="font-display font-bold text-sm">{title}</h3>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-warning shrink-0" />
      </div>
    </div>
  );
  if (!to) return body;
  return <Link to={to} className="block">{body}</Link>;
}



interface HomeSummary {
  toolsInUse: number;
  vehiclesOut: number;
}

function SummaryCards({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stats = await api.get<{ toolsInUse: number; vehiclesOut: number }>("/stats/me");
        setSummary({
          toolsInUse: stats.toolsInUse,
          vehiclesOut: stats.vehiclesOut,
        });
      } catch (e) {
        console.error("Error loading summary:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  const items = [
    {
      label: "Ferramentas em uso",
      value: summary.toolsInUse,
      icon: <Wrench className="w-4 h-4" />,
      color: summary.toolsInUse > 0 ? "text-primary" : "text-muted-foreground",
      bgColor: summary.toolsInUse > 0 ? "bg-primary/10" : "bg-muted",
    },
    {
      label: "Veículos em uso",
      value: summary.vehiclesOut,
      icon: <Car className="w-4 h-4" />,
      color: summary.vehiclesOut > 0 ? "text-primary" : "text-muted-foreground",
      bgColor: summary.vehiclesOut > 0 ? "bg-primary/10" : "bg-muted",
    },
  ];

  return (
    <Link to="/historico" className="block w-full">
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full hover:opacity-80 transition-opacity">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${item.bgColor}`}
          >
            <span className={item.color}>{item.icon}</span>
            <span className={`text-xs font-medium ${item.color}`}>
              {`${item.value} ${item.label.toLowerCase()}`}
            </span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-1">Toque para ver seu histórico unificado →</p>
    </Link>
  );
}

export default function Home() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";
  const {
    toolPending,
    toolOverdue,
    vehiclePending,
    vehicleOverdue,
  } = useUrgencyBadges();
  const { data: pendingCount } = useHomePendingCount(user?.id);

  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  const modules: (ModuleCardProps & { id: string })[] = [
    {
      id: "tour-ferramentas",
      title: "Ferramentas",
      description: "Retiradas, devoluções e manutenções",
      icon: <Wrench className="w-6 h-6" />,
      to: "/ferramentas",
      pendingCount: toolPending,
      overdueCount: toolOverdue,
    },
    {
      id: "tour-veiculos",
      title: "Veículos",
      description: "Entradas e saídas de veículos",
      icon: <Car className="w-6 h-6" />,
      to: "/veiculos",
      pendingCount: vehiclePending,
      overdueCount: vehicleOverdue,
    },
    {
      id: "tour-pendencias",
      title: "Pendências",
      description: "Ferramentas que você precisa devolver",
      icon: <Clock className="w-6 h-6" />,
      to: "/devolucoes-pendentes",
      pendingCount: (pendingCount?.total || 0) - (pendingCount?.overdue || 0),
      overdueCount: pendingCount?.overdue || 0,
    },
    {
      id: "tour-historico",
      title: "Meu Histórico",
      description: "Veja todas as suas movimentações",
      icon: <History className="w-6 h-6" />,
      to: "/historico",
    },
    ...(isAdmin
      ? [
          {
            id: "tour-admin",
            title: "Administração",
            description: "Usuários, relatórios e configurações",
            icon: <Shield className="w-6 h-6" />,
            to: "/admin",
            variant: "admin" as const,
          },
        ]
      : []),
  ];

  // -------- MOBILE LAYOUT --------
  if (isMobile) {
    const firstName = profile?.full_name?.split(" ")[0] || "";
    const roleLabel =
      profile?.role === "admin"
        ? "Administrador"
        : profile?.role === "third_party"
        ? "Terceiro"
        : "Colaborador";

    const adminModule = modules.find((m) => m.variant === "admin");
    const regularModules = modules.filter((m) => m.variant !== "admin");
    const [featured, ...rest] = regularModules;

    return (
      <div className="flex flex-col flex-1 pb-6">
        {/* Hero */}
        <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-5 pt-6 pb-20 rounded-b-3xl">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Engemase"
              className="w-11 h-11 rounded-full shrink-0 object-cover"
            />


            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-80 font-semibold">
                {roleLabel}
              </p>
              <h1 className="font-display text-xl font-bold leading-tight truncate">
                Olá, {firstName} 👋
              </h1>
            </div>
          </div>
        </header>

        {/* Floating status card */}
        {user && (
          <div className="px-4 -mt-14 mb-5 relative z-10">
            <div className="rounded-2xl bg-card border shadow-elevated p-3">
              <SummaryCards userId={user.id} />
            </div>
          </div>
        )}



        <div className="px-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Acesso rápido
            </p>
            <span className="text-[11px] text-muted-foreground">
              {regularModules.length} módulos
            </span>
          </div>

          {featured && (
            <div id={featured.id} className="mb-3">
              <FeaturedTile {...featured} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {rest.map((m) => (
              <div id={m.id} key={m.id}>
                <CompactTile {...m} />
              </div>
            ))}
            <CompactTile
              title="Ajuda & Suporte"
              description="Tutoriais e dúvidas"
              icon={<HelpCircle className="w-5 h-5" />}
              to="/ajuda"
            />

          </div>


          {adminModule && (
            <div id={adminModule.id} className="mt-4">
              <AdminBanner {...adminModule} />
            </div>
          )}

          {!isStandalone && (
            <div className="mt-4">
              <InstallPWACard isIOS={isIOS} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------- DESKTOP / TABLET LAYOUT --------
  const firstName = profile?.full_name?.split(" ")[0] || "";
  const roleLabel =
    profile?.role === "admin"
      ? "Administrador"
      : profile?.role === "third_party"
      ? "Terceiro"
      : "Colaborador";
  const adminModuleDesk = modules.find((m) => m.variant === "admin");
  const regularModulesDesk = modules.filter((m) => m.variant !== "admin");
  const [featuredDesk, ...restDesk] = regularModulesDesk;

  return (
    <div className="flex flex-col flex-1 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 pb-8">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-8 lg:px-12 pt-10 pb-28 rounded-b-[2rem]">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-32 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-12 right-48 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto flex items-center gap-5">
          <img
            src="/icon-192.png"
            alt="Engemase Engenharia"
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full shrink-0 object-cover shadow-md"
          />


          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] opacity-80 font-semibold">
              {roleLabel} · Engemase
            </p>
            <h1 className="font-display text-3xl lg:text-4xl font-bold leading-tight">
              Olá, {firstName} 👋
            </h1>
            <p className="text-sm lg:text-base opacity-90 mt-1">
              Sistema de Gestão de Ativos — selecione um módulo para começar
            </p>
          </div>

          {!isStandalone && (
            <div className="hidden md:block shrink-0 self-start">
              <InstallPWAHeroButton isIOS={isIOS} />
            </div>
          )}
        </div>
      </header>

      {user && (
        <div className="px-6 lg:px-12 -mt-16 mb-8 relative z-10 max-w-6xl mx-auto w-full">
          <div className="rounded-2xl bg-card border shadow-elevated p-4">
            <SummaryCards userId={user.id} />
          </div>
        </div>
      )}

      <div className="px-6 lg:px-12 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Acesso rápido
          </p>
          <span className="text-xs text-muted-foreground">
            {regularModulesDesk.length} módulos disponíveis
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredDesk && (
            <div id={featuredDesk.id} className="col-span-2 lg:row-span-2">
              <FeaturedTileLarge {...featuredDesk} />
            </div>
          )}
          {restDesk.map((m) => (
            <div id={m.id} key={m.id}>
              <ModuleCard {...m} />
            </div>
          ))}
          <div>
            <ModuleCard
              title="Ajuda & Suporte"
              description="Tutoriais, dúvidas frequentes e contato"
              icon={<HelpCircle className="w-6 h-6" />}
              to="/ajuda"
            />
          </div>
        </div>

        {adminModuleDesk && (
          <div id={adminModuleDesk.id} className="mt-6">
            <AdminBanner {...adminModuleDesk} />
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedTileLarge({
  title,
  description,
  icon,
  to,
  disabled,
  badgeCount,
  pendingCount,
  overdueCount,
}: ModuleCardProps) {
  const urgent = (overdueCount || 0) + (badgeCount || 0);
  const pending = pendingCount || 0;

  const body = (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-card p-6 transition-all hover:shadow-elevated hover:-translate-y-0.5 hover:border-primary/60 flex flex-col justify-between">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10" />
      <div className="absolute right-12 bottom-8 w-20 h-20 rounded-full bg-primary/5" />
      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            {icon}
          </div>
          {urgent > 0 ? (
            <span className="px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {urgent} urgente{urgent > 1 ? "s" : ""}
            </span>
          ) : pending > 0 ? (
            <span className="px-3 py-1 rounded-full bg-warning text-warning-foreground text-xs font-bold">
              {pending} pendente{pending > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold uppercase tracking-wider">
              Ativo
            </span>
          )}
        </div>
        <p className="text-[11px] uppercase tracking-wider text-primary font-bold mb-1">
          Módulo principal
        </p>
        <h3 className="font-display text-2xl font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
      <div className="relative mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Abrir módulo completo</span>
        <span className="text-sm font-semibold text-primary">Acessar →</span>
      </div>
    </div>
  );

  if (disabled || !to) return body;
  return <Link to={to} className="block h-full">{body}</Link>;
}

