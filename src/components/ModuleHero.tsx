import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModuleHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Reduces vertical spacing for dense form screens. */
  compact?: boolean;
  /** Optional floating content (e.g. stats cards) overlaying the bottom of the hero. */
  floating?: ReactNode;
  /** When true, omit the negative margin breakout (use inside pages that don't use the standard padding). */
  inline?: boolean;
  /** Constrain inner hero content width to match form pages (max-w-4xl) instead of the default max-w-6xl. */
  narrow?: boolean;
}

export function ModuleHero({ eyebrow, title, subtitle, compact, floating, inline, narrow }: ModuleHeroProps) {
  const inner = narrow ? "max-w-4xl" : "max-w-6xl";
  return (
    <div className={inline ? "" : "-mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6"}>
      <header
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-4 sm:px-6 md:px-8 lg:px-12 rounded-b-3xl lg:rounded-b-[2rem]",
          compact ? "pt-3 sm:pt-4 lg:pt-5 pb-5 sm:pb-6 lg:pb-8" : "pt-4 sm:pt-6 lg:pt-8 pb-16 sm:pb-20 lg:pb-24"
        )}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 lg:w-96 lg:h-96 rounded-full bg-white/10 blur-2xl lg:blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-6 lg:right-32 w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className={cn("relative mx-auto", inner)}>
          <p className="text-[10px] lg:text-xs uppercase tracking-[0.25em] opacity-80 font-semibold">
            {eyebrow}
          </p>
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] sm:text-sm lg:text-base opacity-90 line-clamp-2 lg:mt-1 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      {floating && (
        <div className={cn("px-3 sm:px-6 lg:px-12 -mt-14 sm:-mt-16 relative z-10 mx-auto w-full", inner)}>
          {floating}
        </div>
      )}
    </div>
  );
}

