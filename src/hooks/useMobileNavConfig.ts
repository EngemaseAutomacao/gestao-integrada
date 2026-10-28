import { useState, useCallback, useEffect } from "react";
import { Home, Wrench, Car, Shield, History } from "lucide-react";

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

export const ALL_TAB_OPTIONS: NavTabItem[] = [
  { id: "home", label: "Início", icon: Home, path: "/" },
  { id: "ferramentas", label: "Ferramentas", icon: Wrench, path: "/ferramentas" },
  { id: "veiculos", label: "Veículos", icon: Car, path: "/veiculos" },
  { id: "historico", label: "Histórico", icon: History, path: "/historico" },
  { id: "admin", label: "Admin", icon: Shield, path: "/admin", adminOnly: true },
];


const DEFAULT_TAB_IDS = ["home", "ferramentas", "veiculos", "admin"];
const STORAGE_KEY = "mobile-tab-config";
const SYNC_EVENT = "mobile-tab-config-changed";
const MAX_TABS = 8;

function readFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out old IDs that no longer exist
        const validIds = new Set(ALL_TAB_OPTIONS.map(t => t.id));
        const filtered = parsed.filter((id: string) => validIds.has(id));
        if (filtered.length > 0) return filtered;
      }
    }
  } catch {}
  return DEFAULT_TAB_IDS;
}

export function useMobileNavConfig() {
  const [selectedIds, setSelectedIds] = useState<string[]>(readFromStorage);

  // Listen for changes from other instances of this hook
  useEffect(() => {
    const handler = () => {
      setSelectedIds(readFromStorage());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const save = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // Notify other hook instances
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_TAB_IDS);
  }, [save]);

  const getSelectedTabs = useCallback(
    (isAdmin: boolean): NavTabItem[] => {
      return selectedIds
        .map((id) => ALL_TAB_OPTIONS.find((t) => t.id === id))
        .filter((t): t is NavTabItem => !!t && (!t.adminOnly || isAdmin));
    },
    [selectedIds]
  );

  return { selectedIds, save, reset, getSelectedTabs, maxTabs: MAX_TABS };
}
