import { useEffect, useState, useRef } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Wrench,
  Car,
  Users,
  Home,
  History,
  ClipboardList,
  Settings,
  Bell, Package,
  Upload,
  LogIn,
  AlertCircle,
  FileText, BarChart3
} from "lucide-react";
import { searchAll } from "@/lib/search";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "tool" | "vehicle" | "user";
  url: string;
}

const NAV_SHORTCUTS = [
  { label: "Início", url: "/", icon: Home, keywords: "home dashboard menu" },
  { label: "Ferramentas", url: "/ferramentas", icon: Wrench, keywords: "ferramentas tools" },
  { label: "Catálogo de Ferramentas", url: "/ferramentas/lista", icon: Package, keywords: "catalogo lista" },
  { label: "Registrar Saída de Ferramenta", url: "/ferramentas/retirada", icon: Upload, keywords: "retirada checkout saida" },
  { label: "Registrar Devolução de Ferramenta", url: "/ferramentas/devolucao", icon: LogIn, keywords: "devolucao checkin" },
  { label: "Meu Histórico de Ferramentas", url: "/ferramentas/historico", icon: History, keywords: "historico" },
  { label: "Histórico Geral", url: "/admin/historico", icon: ClipboardList, keywords: "historico geral ferramentas veiculos movimentacoes" },

  { label: "Veículos", url: "/veiculos", icon: Car, keywords: "veiculos cars" },
  { label: "Lista de Veículos", url: "/veiculos/lista", icon: Package, keywords: "veiculos lista" },
  
  { label: "Notas de Atualização", url: "/changelog", icon: FileText, keywords: "changelog versao novidades" },
  { label: "Ajuda", url: "/ajuda", icon: AlertCircle, keywords: "ajuda help" },
];

const ADMIN_SHORTCUTS = [
  { label: "Painel Administrativo", url: "/admin", icon: Settings, keywords: "admin painel" },
  { label: "Usuários", url: "/admin/users", icon: Users, keywords: "usuarios users" },
  { label: "Logs do Sistema", url: "/admin/logs", icon: ClipboardList, keywords: "logs auditoria" },
  { label: "Histórico Geral (Ferramentas)", url: "/admin/history", icon: ClipboardList, keywords: "historico admin" },
  { label: "Histórico Geral (Veículos)", url: "/admin/vehicle-history", icon: ClipboardList, keywords: "veiculos historico admin" },
  { label: "Relatórios", url: "/admin/reports", icon: FileText, keywords: "relatorios reports" },
  { label: "Analytics Geral", url: "/admin/analytics", icon: BarChart3, keywords: "analytics estatisticas" },
  { label: "Notificações", url: "/admin/notifications", icon: Bell, keywords: "notificacoes" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced async search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const all = await searchAll(query, 6);
        setResults(all);
      } catch (e) {
        console.error("CommandPalette search error:", e);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isAdmin]);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  const iconFor = {
    tool: <Wrench className="text-primary" />,
    vehicle: <Car className="text-primary" />,
    user: <Users className="text-orange-500" />,
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar ferramentas, veículos, telas... (Ctrl+K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Buscando..." : "Nenhum resultado."}
        </CommandEmpty>

        {results.length > 0 && (
          <>
            <CommandGroup heading="Resultados">
              {results.map((r) => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  value={`${r.type}-${r.label}-${r.sublabel ?? ""}`}
                  onSelect={() => go(r.url)}
                >
                  {iconFor[r.type]}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.sublabel && (
                      <span className="text-xs text-muted-foreground">{r.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegação">
          {NAV_SHORTCUTS.map((s) => (
            <CommandItem
              key={s.url}
              value={`${s.label} ${s.keywords}`}
              onSelect={() => go(s.url)}
            >
              <s.icon className="text-muted-foreground" />
              <span>{s.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Administração">
              {ADMIN_SHORTCUTS.map((s) => (
                <CommandItem
                  key={s.url}
                  value={`${s.label} ${s.keywords}`}
                  onSelect={() => go(s.url)}
                >
                  <s.icon className="text-muted-foreground" />
                  <span>{s.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
