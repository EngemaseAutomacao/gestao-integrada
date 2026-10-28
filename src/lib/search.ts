import { api } from "@/lib/api";

export interface GlobalSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "tool" | "vehicle" | "user";
  url: string;
}

interface SearchResponse {
  tools: { id: string; name: string; brand: string | null; tag: string | null }[];
  vehicles: { id: string; name: string; plate: string; brand: string | null }[];
  users: { id: string; full_name: string; email: string }[];
}

/** Busca ferramentas, veículos e (para admin) usuários. O servidor aplica as permissões. */
export async function searchAll(term: string, limit = 6): Promise<GlobalSearchResult[]> {
  const data = await api.get<SearchResponse>("/search", { q: term, limit });
  return [
    ...data.tools.map((t) => ({
      id: t.id,
      label: t.name,
      sublabel: [t.brand, t.tag].filter(Boolean).join(" • "),
      type: "tool" as const,
      url: `/ferramentas/${t.id}`,
    })),
    ...data.vehicles.map((v) => ({
      id: v.id,
      label: `${v.name} (${v.plate})`,
      sublabel: v.brand || undefined,
      type: "vehicle" as const,
      url: `/veiculos/${v.id}`,
    })),
    ...data.users.map((u) => ({
      id: u.id,
      label: u.full_name,
      sublabel: u.email,
      type: "user" as const,
      url: `/admin/users`,
    })),
  ];
}
