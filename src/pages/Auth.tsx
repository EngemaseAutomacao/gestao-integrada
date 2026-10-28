import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, User, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import engemaseLogo from "@/assets/engemase-logo.png";
import { APP_VERSION } from "@/version";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(
    () => localStorage.getItem("engemase_keep_connected") !== "false",
  );
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (profile.first_login) {
        navigate("/change-password");
      } else {
        navigate("/");
      }
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(username, password, keepConnected);
      if (error) {
        toast.error("Erro ao fazer login", {
          description: error.message,
        });
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error("Erro inesperado", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-[15%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-40 mb-4">
            <img
              src={engemaseLogo}
              alt="Engemase Engenharia"
              width={672}
              height={294}
              decoding="async"
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Gestão Integrada
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground">Bem-vindo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acesse sua conta para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">
                  Usuário
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="nome.sobrenome"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="pl-10 h-11 rounded-xl"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={keepConnected}
                  onCheckedChange={(v) => setKeepConnected(v === true)}
                />
                Mantenha-me conectado
              </label>


              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/20"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Acessar Sistema
              </Button>
            </form>
          </div>

          <div className="px-6 sm:px-8 py-4 bg-muted/40 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Novo colaborador?{" "}
              <Link
                to="/register"
                className="font-bold text-primary hover:underline"
              >
                Solicitar acesso
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70 uppercase tracking-widest">
          v{APP_VERSION} · Engemase Engenharia
        </p>
      </div>
    </div>
  );
}
