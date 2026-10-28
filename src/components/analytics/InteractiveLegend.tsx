import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface LegendSeries {
  key: string;
  name: string;
  /** CSS color used to render the chart by default (e.g. "hsl(var(--primary))") */
  defaultColor: string;
  /** Hex fallback used to seed the color picker (must be #rrggbb) */
  fallbackHex: string;
}

export function useInteractiveLegend(series: LegendSeries[]) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colors, setColors] = useState<Record<string, string>>({});

  const getColor = useCallback(
    (key: string) => {
      const s = series.find((x) => x.key === key);
      return colors[key] ?? s?.defaultColor ?? "hsl(var(--primary))";
    },
    [colors, series]
  );

  const getPickerValue = useCallback(
    (key: string) => {
      const s = series.find((x) => x.key === key);
      return colors[key] ?? s?.fallbackHex ?? "#000000";
    },
    [colors, series]
  );

  const isHidden = useCallback((key: string) => hidden.has(key), [hidden]);

  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setColor = useCallback((key: string, hex: string) => {
    setColors((prev) => ({ ...prev, [key]: hex }));
  }, []);

  return useMemo(
    () => ({ series, getColor, getPickerValue, isHidden, toggle, setColor }),
    [series, getColor, getPickerValue, isHidden, toggle, setColor]
  );
}

export type LegendController = ReturnType<typeof useInteractiveLegend>;

interface InteractiveLegendProps {
  controller: LegendController;
  className?: string;
}

export function InteractiveLegend({ controller, className }: InteractiveLegendProps) {
  const { series, getColor, getPickerValue, isHidden, toggle, setColor } = controller;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3", className)}>
      {series.map((s) => {
        const hidden = isHidden(s.key);
        return (
          <div key={s.key} className="flex items-center gap-1.5 text-xs select-none">
            <label
              className="relative inline-block h-3.5 w-3.5 rounded-sm border border-border cursor-pointer shadow-sm"
              style={{ backgroundColor: hidden ? "transparent" : getColor(s.key), borderColor: hidden ? "hsl(var(--border))" : getColor(s.key) }}
              title="Clique para alterar a cor"
            >
              <input
                type="color"
                aria-label={`Alterar cor de ${s.name}`}
                value={getPickerValue(s.key)}
                onChange={(e) => setColor(s.key, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={() => toggle(s.key)}
              className={cn(
                "transition-opacity hover:opacity-80",
                hidden && "line-through text-muted-foreground opacity-60"
              )}
              title="Clique para ocultar/exibir"
            >
              {s.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
