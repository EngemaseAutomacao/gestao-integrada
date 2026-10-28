import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Site {
  id: string;
  name: string;
}

interface ConstructionSiteAutocompleteProps {
  sites: Site[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function getSearchableName(name: string): string {
  // Remove leading numbers and dash, e.g. "001 - Obra X" -> "Obra X"
  const match = name.match(/^\d+\s*[-–—]\s*(.+)/);
  return match ? match[1].trim() : name;
}

export function ConstructionSiteAutocomplete({
  sites,
  value,
  onChange,
  placeholder = "Digite para buscar a obra...",
  disabled = false,
}: ConstructionSiteAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter sites based on input, ignoring leading numbers
  const filtered = inputValue.trim()
    ? sites.filter((site) => {
        const searchable = getSearchableName(site.name).toLowerCase();
        const fullName = site.name.toLowerCase();
        const query = inputValue.toLowerCase().trim();
        return searchable.includes(query) || fullName.includes(query);
      })
    : sites;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Texto livre não é aceito: só validamos o valor ao selecionar uma obra existente
    if (value) onChange("");
  };

  const selectSite = (siteName: string) => {
    setInputValue(siteName);
    onChange(siteName);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        selectSite(filtered[highlightedIndex].name);
      } else if (filtered.length === 1) {
        // Auto-seleciona se houver apenas uma correspondência
        selectSite(filtered[0].name);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close on outside click — se o texto digitado não bate com uma obra, limpa
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        const match = sites.find(
          (s) => s.name.toLowerCase() === inputValue.trim().toLowerCase()
        );
        if (match) {
          if (match.name !== value) onChange(match.name);
        } else {
          // Reverte para o último valor válido (ou limpa)
          setInputValue(value);
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [inputValue, value, onChange, sites]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {filtered.map((site, index) => (
            <li
              key={site.id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                highlightedIndex === index && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSite(site.name);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {site.name}
            </li>
          ))}
        </ul>
      )}
      {isOpen && inputValue.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
          Nenhuma obra encontrada. Selecione uma obra existente da lista.
        </div>
      )}
    </div>
  );
}
