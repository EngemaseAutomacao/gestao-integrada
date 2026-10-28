import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { setAppBadge, registerPeriodicSync } from "@/lib/pwa";

/**
 * Mantém o badge do ícone do app sincronizado com o número
 * de notificações não lidas. Também registra Periodic Background Sync (best-effort).
 */
export function useAppBadge() {
  const { user } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread-count", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const { count } = await api.get<{ count: number }>("/notifications/unread-count");
        return count;
      } catch {
        return 0;
      }
    },
  });

  useEffect(() => {
    setAppBadge(unreadCount);
  }, [unreadCount]);

  // Registra periodic sync uma vez (best-effort, silencioso)
  useEffect(() => {
    if (!user?.id) return;
    registerPeriodicSync().catch(() => {});
  }, [user?.id]);
}
