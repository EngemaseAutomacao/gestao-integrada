import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BellRing, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("notification-sound") !== "disabled";
  });
  
  const { playNotificationSound } = useNotificationSound();
  const { permission, isSupported, isSubscribed, subscribe } = usePushNotifications();
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Auto-subscribe if permission already granted but not subscribed
  useEffect(() => {
    if (isSupported && permission === "granted" && !isSubscribed && user) {
      subscribe();
    }
  }, [isSupported, permission, isSubscribed, user, subscribe]);

  const handleNewNotification = useCallback((notification: Notification) => {
    // Show toast popup
    toast(notification.title, {
      description: notification.message,
      duration: 5000,
      action: {
        label: "Ver",
        onClick: () => setOpen(true),
      },
    });

    // Play sound if enabled
    if (soundEnabled) {
      playNotificationSound();
    }

    // Push notifications are delivered by the backend edge function (check-notifications)
    // Do NOT show local push here to avoid duplicate/empty notifications
  }, [soundEnabled, playNotificationSound]);

  const loadNotifications = useCallback(async () => {
    try {
      const notificationData = await api.get<Notification[]>("/notifications", { limit: 20 });
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.read).length);

      if (isInitialLoad.current) {
        // Primeira carga: só registra os IDs, sem alertar.
        isInitialLoad.current = false;
      } else {
        notificationData
          .filter(n => !previousNotificationIds.current.has(n.id) && !n.read)
          .reverse()
          .forEach(handleNewNotification);
      }
      previousNotificationIds.current = new Set(notificationData.map(n => n.id));
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  }, [handleNewNotification]);

  // Antes: canal realtime do Supabase. Agora: consulta a cada 30s e ao voltar para a aba.
  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await api.post("/notifications/read", { ids: [id] });

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      toast.error("Erro ao marcar notificação", {
        description: error.message,
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      await api.post("/notifications/read", { all: true });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("Todas as notificações foram marcadas como lidas");
    } catch (error: any) {
      toast.error("Erro ao marcar notificações", {
        description: error.message,
      });
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("notification-sound", newValue ? "enabled" : "disabled");
    toast.success(newValue ? "Som de notificação ativado" : "Som de notificação desativado");
  };

  const handleEnablePush = async () => {
    const success = await subscribe();
    if (success) {
      toast.success("Notificações push ativadas e registradas!");
    } else {
      toast.error("Erro ao ativar notificações push. Verifique a permissão do navegador.");
    }
  };

  /** Envia um push de teste para os aparelhos do próprio usuário (diagnóstico). */
  const sendTestNotification = async () => {
    try {
      const data = await api.post<{ sentCount: number; subscriptionsCount: number }>("/notifications/test");
      if (!data.subscriptionsCount) {
        toast.error("Nenhum aparelho com notificações ativadas", {
          description: "Abra o app no celular e toque em \"Ativar push\" no sininho.",
        });
      } else if (!data.sentCount) {
        toast.error("O envio do push falhou", {
          description: "Abra o app no celular uma vez para renovar a inscrição e tente de novo.",
        });
      } else {
        toast.success("Notificação de teste enviada!", {
          description: `Entregue em ${data.sentCount} de ${data.subscriptionsCount} aparelho(s).`,
        });
      }
    } catch (error) {
      toast.error("Não foi possível enviar o teste", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "overdue":
        return "text-destructive";
      case "low_stock":
        return "text-orange-500";
      case "return_reminder":
        return "text-primary";
      default:
        return "";
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 flex items-center justify-center p-0 text-[10px] leading-none rounded-full"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-popover border shadow-lg z-50" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações</h3>
            <div className="flex items-center gap-1">
              {/* Sound toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleSound}
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {soundEnabled ? "Desativar som" : "Ativar som"}
                </TooltipContent>
              </Tooltip>

              {/* Push notification toggle */}
              {isSupported && permission !== "granted" && !isSubscribed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEnablePush}
                  className="text-xs"
                >
                  Ativar push
                </Button>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={sendTestNotification}>
                    <BellRing className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enviar notificação de teste</TooltipContent>
              </Tooltip>

              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Marcar lidas
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma notificação
              </p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      notification.read
                        ? "bg-background"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`font-semibold text-sm ${getNotificationColor(
                            notification.type
                          )}`}
                        >
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <Badge
                            variant="default"
                            className="h-2 w-2 p-0 rounded-full"
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(notification.created_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
