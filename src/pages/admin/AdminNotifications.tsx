import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bell, Loader2, AlertCircle, Package, Clock, Send, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function AdminNotifications() {
  const { profile } = useAuth();
  const [sendLoading, setSendLoading] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");

  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: ["approved-profiles-basic"],
    queryFn: async () => {
      const data = await api.get<Profile[]>("/users", { approved: "true" });
      return data.map(({ id, full_name, email, role }) => ({ id, full_name, email, role }) as Profile);
    },
    staleTime: 60_000,
  });

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  const sendManualNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }

    setSendLoading(true);
    try {
      let targetUsers: string[] = [];

      if (notifTarget === "all") {
        targetUsers = users.map((u) => u.id);
      } else if (notifTarget === "admins") {
        targetUsers = users.filter((u) => u.role === "admin").map((u) => u.id);
      } else if (notifTarget === "employees") {
        targetUsers = users.filter((u) => u.role !== "admin").map((u) => u.id);
      } else {
        targetUsers = [notifTarget];
      }

      // Um único envio em lote (antes era uma chamada por usuário e estourava o limite de 50/min).
      const result = await api.post<{ sentCount: number }>("/notifications/send", {
        userIds: targetUsers,
        type: "manual",
        title: notifTitle.trim(),
        body: notifMessage.trim(),
      });
      const deliveredCount = result.sentCount;

      toast.success(`Notificação enviada para ${targetUsers.length} usuário(s)!`, {
        description: `Push entregue em ${deliveredCount} dispositivo(s).`,
      });
      setNotifTitle("");
      setNotifMessage("");
      setNotifTarget("all");
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast.error("Erro ao enviar notificação", { description: error.message });
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHero icon={Bell} title="Sistema de Notificações" subtitle="Gerencie e envie notificações do sistema" />

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este sistema verifica automaticamente ferramentas atrasadas e envia lembretes de devolução.
          Notificações com mais de 7 dias são removidas automaticamente.
        </AlertDescription>
      </Alert>

      {/* Manual notification sender */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Enviar Notificação Manual
          </CardTitle>
          <CardDescription>
            Envie uma notificação personalizada para usuários específicos ou para todos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notif-target">Destinatário</Label>
              <Select value={notifTarget} onValueChange={setNotifTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o destinatário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Usuários</SelectItem>
                  <SelectItem value="admins">Apenas Administradores</SelectItem>
                  <SelectItem value="employees">Apenas Funcionários</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-title">Título</Label>
              <Input
                id="notif-title"
                placeholder="Título da notificação"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-message">Mensagem</Label>
            <Textarea
              id="notif-message"
              placeholder="Escreva a mensagem da notificação..."
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={sendManualNotification} disabled={sendLoading} className="w-full sm:w-auto">
            {sendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            {sendLoading ? "Enviando..." : "Enviar Notificação"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Ferramentas Atrasadas
            </CardTitle>
            <CardDescription>
              Notifica usuários quando ferramentas não são devolvidas na data prevista
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Verifica a cada execução</li>
              <li>• Notifica apenas uma vez por dia</li>
              <li>• Baseado na data de devolução estimada</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Lembretes de Devolução
            </CardTitle>
            <CardDescription>
              Lembra usuários de devolver ferramentas próximo à data prevista
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• 3 dias antes da devolução</li>
              <li>• Notifica apenas uma vez por dia</li>
              <li>• Ajuda a evitar atrasos</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-green-500" />
              Checkout/Checkin Ferramentas
            </CardTitle>
            <CardDescription>
              Notificação automática em tempo real via trigger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Admins notificados em cada retirada</li>
              <li>• Admins notificados em cada devolução</li>
              <li>• Usuário recebe confirmação</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Checkout/Checkin Veículos
            </CardTitle>
            <CardDescription>
              Notificação automática em tempo real via trigger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Admins notificados em cada retirada</li>
              <li>• Admins notificados em cada devolução</li>
              <li>• Usuário recebe confirmação</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Problemas Reportados
            </CardTitle>
            <CardDescription>
              Admins notificados quando problemas são reportados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Notificação imediata ao admin</li>
              <li>• Inclui severidade do problema</li>
              <li>• Link para a ferramenta afetada</li>
            </ul>
          </CardContent>
        </Card>


        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Ferramenta em Atraso (Usuário)
            </CardTitle>
            <CardDescription>
              Lembrete diário ao usuário com ferramenta atrasada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Notificação diária ao usuário</li>
              <li>• Informa quantos dias de atraso</li>
              <li>• Incentiva a devolução</li>
            </ul>
          </CardContent>
        </Card>


        <Card className="border-rose-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              Veículo em Uso Prolongado
            </CardTitle>
            <CardDescription>
              Lembrete ao usuário após 24h com veículo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Após 24h sem devolução</li>
              <li>• Lembrete diário ao usuário</li>
              <li>• Informa horas de uso</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-500" />
            Automatização Ativa
          </CardTitle>
          <CardDescription>
            As verificações periódicas são executadas automaticamente a cada hora
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Ferramentas atrasadas (admin + usuário)</li>
            <li>• Estoque baixo (admin)</li>
            <li>• Lembretes de devolução (usuário)</li>
            <li>• Manutenção preventiva (admin)</li>
            <li>• Veículos em uso prolongado (usuário)</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Limpeza Automática
          </CardTitle>
          <CardDescription>
            Notificações com mais de 7 dias são removidas automaticamente todos os dias às 03:00
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Execução diária às 03:00 (horário do servidor)</li>
            <li>• Remove notificações lidas e não lidas</li>
            <li>• Mantém a caixa de notificações organizada</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
