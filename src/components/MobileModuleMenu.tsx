import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface MobileMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  badgeCount?: number;
  variant?: "default" | "admin" | "primary";
}

interface MobileModuleMenuProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  heroIcon: React.ReactNode;
  items: MobileMenuItem[];
  adminItems?: MobileMenuItem[];
}

function Tile({ item }: { item: MobileMenuItem }) {
  const isAdmin = item.variant === "admin";
  const badge = item.badgeCount && item.badgeCount > 0 ? item.badgeCount : null;
  return (
    <Link to={item.to} className="block h-full">
      <div
        className={`group relative h-full rounded-2xl border bg-card p-3.5 lg:p-5 active:scale-[0.97] transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-elevated ${
          isAdmin ? "border-warning/40 bg-warning/5" : ""
        }`}
      >
        <div className="flex items-start justify-between mb-3 lg:mb-4">
          <div
            className={`w-11 h-11 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-colors ${
              isAdmin
                ? "bg-warning/15 text-warning group-hover:bg-warning group-hover:text-warning-foreground"
                : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
            }`}
          >
            {item.icon}
          </div>
          {badge && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground">
              {badge}
            </span>
          )}
        </div>
        <h3 className="font-display font-semibold text-sm lg:text-base leading-tight">{item.title}</h3>
        <p className="text-[11px] lg:text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
        <div className="hidden lg:flex mt-4 pt-3 border-t border-border/60 items-center justify-between text-xs">
          <span className="text-muted-foreground">Abrir</span>
          <span
            className={`font-semibold transition-transform group-hover:translate-x-0.5 ${
              isAdmin ? "text-warning" : "text-primary"
            }`}
          >
            Acessar →
          </span>
        </div>
      </div>
    </Link>
  );
}

function FeaturedTile({ item }: { item: MobileMenuItem }) {
  const badge = item.badgeCount && item.badgeCount > 0 ? item.badgeCount : null;
  return (
    <Link to={item.to} className="block lg:h-full">
      {/* Mobile compact featured */}
      <div className="lg:hidden relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 active:scale-[0.99] transition-all shadow-soft">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-primary/10" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shrink-0">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base">{item.title}</h3>
              {badge && (
                <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
            <span className="text-[11px] font-semibold text-primary mt-1 inline-block">Abrir agora →</span>
          </div>
        </div>
      </div>

      {/* Desktop large featured */}
      <div className="hidden lg:flex relative h-full min-h-[260px] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-card p-6 transition-all hover:shadow-elevated hover:-translate-y-0.5 hover:border-primary/60 flex-col justify-between">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10" />
        <div className="absolute right-12 bottom-8 w-20 h-20 rounded-full bg-primary/5" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
              {item.icon}
            </div>
            {badge ? (
              <span className="px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {badge} urgente{badge > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold uppercase tracking-wider">
                Ativo
              </span>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-wider text-primary font-bold mb-1">
            Destaque do módulo
          </p>
          <h3 className="font-display text-2xl font-bold mb-2">{item.title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">{item.description}</p>
        </div>
        <div className="relative mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Acesso prioritário</span>
          <span className="text-sm font-semibold text-primary">Acessar →</span>
        </div>
      </div>
    </Link>
  );
}

function AdminBanner({ item }: { item: MobileMenuItem }) {
  const badge = item.badgeCount && item.badgeCount > 0 ? item.badgeCount : null;
  return (
    <Link to={item.to} className="block">
      <div className="relative overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-r from-warning/15 via-warning/10 to-transparent p-4 lg:p-5 active:scale-[0.99] transition-all hover:shadow-elevated">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-warning text-warning-foreground flex items-center justify-center shrink-0">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-warning font-bold">Administração</p>
            <h3 className="font-display font-bold text-sm lg:text-base">{item.title}</h3>
            <p className="text-[11px] lg:text-xs text-muted-foreground line-clamp-1">{item.description}</p>
          </div>
          {badge && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground">
              {badge}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-warning shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export function MobileModuleMenu({
  eyebrow,
  title,
  subtitle,
  heroIcon,
  items,
  adminItems = [],
}: MobileModuleMenuProps) {
  const [featured, ...rest] = items;

  return (
    <div className="flex flex-col flex-1 pb-6 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-5 lg:px-12 pt-6 lg:pt-10 pb-20 lg:pb-28 rounded-b-3xl lg:rounded-b-[2rem]">
        <div className="absolute -top-10 -right-10 w-40 h-40 lg:w-96 lg:h-96 rounded-full bg-white/10 blur-2xl lg:blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-6 lg:right-32 w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute hidden lg:block top-12 right-48 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto flex items-center gap-3 lg:gap-5">
          <div className="w-11 h-11 lg:w-16 lg:h-16 rounded-xl lg:rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0">
            {heroIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] lg:text-xs uppercase tracking-[0.2em] lg:tracking-[0.25em] opacity-80 font-semibold">
              {eyebrow}
            </p>
            <h1 className="font-display text-xl lg:text-3xl xl:text-4xl font-bold leading-tight truncate">{title}</h1>
            <p className="text-[11px] lg:text-sm opacity-80 line-clamp-1 lg:mt-1">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-12 -mt-14 lg:-mt-16 relative z-10 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3 lg:mb-4 px-1">
          <p className="text-[11px] lg:text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Acesso rápido
          </p>
          <span className="text-[11px] lg:text-xs text-muted-foreground">
            {items.length} opções
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {featured && (
            <div className="col-span-2 lg:row-span-2">
              <FeaturedTile item={featured} />
            </div>
          )}
          {rest.map((item) => (
            <Tile key={item.to + item.title} item={item} />
          ))}
        </div>

        {adminItems.length > 0 && (
          <>
            <p className="text-[11px] lg:text-xs uppercase tracking-wider text-warning font-bold mt-6 mb-3 px-1">
              Administração
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              {adminItems.map((item) => (
                <AdminBanner key={item.to + item.title} item={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
