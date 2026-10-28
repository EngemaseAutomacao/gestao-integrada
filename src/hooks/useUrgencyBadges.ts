import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface UrgencyData {
  toolOverdue: number;
  toolPending: number;
  vehicleOverdue: number;
  vehiclePending: number;
}

export function useUrgencyBadges() {
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["urgency-badges", profile?.id],
    queryFn: async (): Promise<UrgencyData> => {
      if (!profile?.id) {
        return { toolOverdue: 0, toolPending: 0, vehicleOverdue: 0, vehiclePending: 0 };
      }

      const stats = await api.get<{ toolsInUse: number; toolsOverdue: number; vehiclesOut: number }>("/stats/me");
      return {
        toolOverdue: stats.toolsOverdue,
        toolPending: stats.toolsInUse,
        vehicleOverdue: 0,
        vehiclePending: stats.vehiclesOut,
      };
    },
    enabled: !!profile?.id,
    refetchInterval: 60000,
  });

  return {
    toolBadgeCount: data?.toolOverdue || 0,
    vehicleBadgeCount: data?.vehicleOverdue || 0,
    toolPending: data?.toolPending || 0,
    toolOverdue: data?.toolOverdue || 0,
    vehiclePending: data?.vehiclePending || 0,
    vehicleOverdue: data?.vehicleOverdue || 0,
  };
}
