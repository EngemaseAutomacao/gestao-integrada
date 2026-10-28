import { badRequest } from "../lib/http.js";

/** Campos de perfil seguros para incluir em listagens. */
export const profileSelect = {
  id: true,
  full_name: true,
  username: true,
  email: true,
  category: true,
} as const;

export const listLimit = (limit?: number) => Math.min(limit ?? 2000, 10000);

/**
 * Intervalo de datas para filtros. Datas sem horário em `to` (ex.: "2026-05-08")
 * passam a incluir o dia inteiro — antes o filtro "até" cortava o próprio dia.
 */
export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const parse = (v: string, endOfDay: boolean) => {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
    // Datas sem hora são interpretadas no fuso de Brasília.
    const d = new Date(dateOnly ? `${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00` : v);
    if (Number.isNaN(d.getTime())) throw badRequest("Data inválida no filtro");
    return d;
  };
  return {
    ...(from ? { gte: parse(from, false) } : {}),
    ...(to ? { lte: parse(to, true) } : {}),
  };
}
