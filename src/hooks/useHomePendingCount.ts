import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHomePendingCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["home-pending-count", userId],
    queryFn: async () => {
      if (!userId) return { total: 0, overdue: 0 };
      const stats = await api.get<{ toolsInUse: number; toolsOverdue: number }>("/stats/me");
      return { total: stats.toolsInUse, overdue: stats.toolsOverdue };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
