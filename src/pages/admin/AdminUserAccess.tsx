import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleHero } from "@/components/ModuleHero";
import { Loader2, Search, User, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserAccessRow {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  category: string | null;
  role: string | null;
  approved: boolean;
  last_sign_in_at: string | null;
  days_since_last_access: number | null;
}

type Filter = "all" | "7" | "15" | "30" | "never";

export default function AdminUserAccess() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");


  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-access"],
    queryFn: async () => {
      return api.get<UserAccessRow[]>("/users/last-access");
    },
  });

  const rows = (data || []).filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.full_name?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filter === "never") return r.last_sign_in_at === null;
    if (filter === "7") return (r.days_since_last_access ?? 9999) >= 7;
    if (filter === "15") return (r.days_since_last_access ?? 9999) >= 15;
    if (filter === "30") return (r.days_since_last_access ?? 9999) >= 30;
    return true;
  });

  const badgeVariant = (days: number | null): "secondary" | "outline" | "destructive" | "default" => {
    if (days === null) return "destructive";
    if (days >= 30) return "destructive";
    if (days >= 15) return "default";
    if (days >= 7) return "secondary";
    return "outline";
  };

  const daysLabel = (row: UserAccessRow) => {
    if (row.last_sign_in_at === null) return "Nunca acessou";
    const d = row.days_since_last_access ?? 0;
    if (d === 0) return "Hoje";
    if (d === 1) return "Ontem";
    return `Há ${d} dias`;
  };

  // Guarda de acesso depois de todos os hooks (regra dos hooks do React).
  if (profile && profile.role !== "admin") return <Navigate to="/" />;
  return (
    <div className="animate-fade-in">
      <ModuleHero
        eyebrow="Módulo · Administração"
        title="Últimos Acessos"
        subtitle="Veja quantos dias faz que cada usuário não entra no sistema"
      />
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome, usuário ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7">Inativos há 7+ dias</SelectItem>
              <SelectItem value="15">Inativos há 15+ dias</SelectItem>
              <SelectItem value="30">Inativos há 30+ dias</SelectItem>
              <SelectItem value="never">Nunca acessaram</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="self-center whitespace-nowrap">
            {rows.length} usuários
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhum usuário encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {row.full_name || "Sem nome"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {row.username ? `@${row.username}` : row.email}
                          {row.role === "admin" && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5">
                              admin
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {row.last_sign_in_at ? (
                            <>
                              Último acesso:{" "}
                              {format(new Date(row.last_sign_in_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </>
                          ) : (
                            <span className="italic">Sem registro de acesso</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={badgeVariant(row.days_since_last_access)}
                      className="gap-1 whitespace-nowrap"
                    >
                      {row.last_sign_in_at === null ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {daysLabel(row)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
