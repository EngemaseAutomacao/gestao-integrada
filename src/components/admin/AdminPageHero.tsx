import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface AdminPageHeroProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional trailing content (badges, counters). Hidden on small screens to preserve hierarchy. */
  right?: ReactNode;
}

/**
 * Hero header used across the Admin panel pages.
 * Mirrors 1:1 the visual language of the Galeria de Imagens page
 * (same gradient, border, radius, icon tile and typography scale).
 */
export function AdminPageHero({ icon: Icon, title, subtitle, right }: AdminPageHeroProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border/50 p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
        {right && (
          <div className="hidden sm:inline-flex shrink-0">{right}</div>
        )}
      </div>
    </div>
  );
}
