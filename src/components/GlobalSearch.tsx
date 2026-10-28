import { useState, useRef, useEffect } from "react";
import { Search, Wrench, Car, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAll } from "@/lib/search";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "tool" | "vehicle" | "user";
  url: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const allResults = await searchAll(term, 5);
      setResults(allResults);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(result.url);
  };

  const iconMap = {
    tool: <Wrench className="w-4 h-4 text-primary shrink-0" />,
    vehicle: <Car className="w-4 h-4 text-primary shrink-0" />,
    user: <Users className="w-4 h-4 text-orange-500 shrink-0" />,
  };

  const typeLabel = {
    tool: "Ferramenta",
    vehicle: "Veículo",
    user: "Usuário",
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Buscar..."
          className="h-8 w-32 sm:w-48 pl-7 pr-7 text-xs bg-muted/50 border-muted"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && (query.length >= 2) && (
        <div className="absolute top-full mt-1 left-0 right-0 sm:w-72 bg-popover border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-xs text-muted-foreground">Buscando...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">Nenhum resultado encontrado</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left transition-colors"
            >
              {iconMap[r.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                {typeLabel[r.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
