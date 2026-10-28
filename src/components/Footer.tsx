import { Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_VERSION, BUILD_DATE } from "@/version";

export function Footer() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const buildDate = new Date(BUILD_DATE).toLocaleDateString("pt-BR");

  return (
    <footer className="border-t bg-card/50 backdrop-blur-sm py-2 px-3 sm:py-3 sm:px-4">
      <div className="flex flex-col items-center gap-1 text-[10px] sm:text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Wrench className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
          <span>Gestão Integrada Engemase</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
          <span>© {currentYear} Engemase Engenharia</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => navigate("/changelog")}
            className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            aria-label="Abrir notas de atualização"
          >
            v{APP_VERSION}
          </button>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Build: {buildDate}</span>
        </div>
      </div>
    </footer>
  );
}
