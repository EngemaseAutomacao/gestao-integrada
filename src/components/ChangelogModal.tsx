import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Bug, Shield } from "lucide-react";
import { changelog } from "@/changelog";
import { APP_VERSION } from "@/version";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const SEEN_VERSION_KEY = "engemase_seen_changelog";

const typeConfig = {
  feature: { label: "Novo", icon: Sparkles, className: "bg-primary/10 text-primary border-primary/20" },
  improvement: { label: "Melhoria", icon: Zap, className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  fix: { label: "Correção", icon: Bug, className: "bg-destructive/10 text-destructive border-destructive/20" },
  security: { label: "Segurança", icon: Shield, className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

export function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || location.pathname === "/auth" || location.pathname === "/register") return;
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    if (seen !== APP_VERSION) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, location.pathname]);

  const handleClose = () => {
    localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
    setOpen(false);
  };

  const currentEntry = changelog.find((e) => e.version === APP_VERSION);
  if (!currentEntry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Novidades da v{currentEntry.version}
          </DialogTitle>
          <DialogDescription>{currentEntry.description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 my-2">
          {currentEntry.changes.map((change, i) => {
            const config = typeConfig[change.type];
            const Icon = config.icon;
            return (
              <li key={i} className="flex items-start gap-2">
                <Badge variant="outline" className={`shrink-0 text-[10px] gap-1 ${config.className}`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </Badge>
                <span className="text-sm">{change.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => { handleClose(); navigate("/changelog"); }}>
            Ver todas as versões
          </Button>
          <Button size="sm" onClick={handleClose}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
