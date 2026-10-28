import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useActiveConstructionSites() {
  return useQuery({
    queryKey: ["construction-sites-active"],
    queryFn: async () => {
      const data = await api.get<{ id: string; name: string }[]>("/construction-sites", { active: "true" });
      // Ordem decrescente por nome (mantida do comportamento anterior: obras mais recentes primeiro).
      return data.map(({ id, name }) => ({ id, name })).reverse();
    },
    staleTime: 5 * 60 * 1000,
  });
}
