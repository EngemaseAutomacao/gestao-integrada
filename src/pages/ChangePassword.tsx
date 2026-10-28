import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, Eye, EyeOff, Check, X } from "lucide-react";
import engemaseLogo from "@/assets/engemase-logo.png";

type Requirement = {
  label: string;
  test: (pw: string) => boolean;
  required: boolean;
};

const REQUIREMENTS: Requirement[] = [
  { label: "Pelo menos 8 caracteres", test: (pw) => pw.length >= 8, required: true },
  { label: "Letra maiúscula (A-Z)", test: (pw) => /[A-Z]/.test(pw), required: true },
  { label: "Letra minúscula (a-z)", test: (pw) => /[a-z]/.test(pw), required: true },
  { label: "Número (0-9)", test: (pw) => /[0-9]/.test(pw), required: true },
  { label: "Símbolo (ex: !@#$%) — opcional", test: (pw) => /[^A-Za-z0-9]/.test(pw), required: false },
];

function getStrength(pw: string): { ok: boolean; label: string; color: string } {
  if (pw.length === 0) return { ok: false, label: "", color: "bg-muted" };
  const ok = REQUIREMENTS.filter((r) => r.required).every((r) => r.test(pw));
  if (ok) return { ok: true, label: "Requisitos atendidos", color: "bg-primary" };
  return { ok: false, label: "Não atende os requisitos", color: "bg-destructive" };
}

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const { user, profile, loading: authLoading, setProfile } = useAuth();
  const navigate = useNavigate();
  const isFirstLogin = profile?.first_login === true;

  // Sem sessão válida (ex.: senha redefinida pelo admin), volta para o login.
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Sessão expirada", {
        description: "Faça login novamente para trocar a senha.",
      });
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);
  const requiredRequirementsMet = useMemo(
    () => REQUIREMENTS.filter((r) => r.required).every((r) => r.test(newPassword)),
    [newPassword]
  );
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requiredRequirementsMet) {
      toast.error("A senha deve ter 8+ caracteres, maiúscula, minúscula e número");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (!isFirstLogin && !currentPassword) {
      toast.error("Informe sua senha atual");
      return;
    }

    setLoading(true);
    try {
      const { profile: updated } = await api.post<{ profile: typeof profile }>("/auth/change-password", {
        currentPassword: isFirstLogin ? undefined : currentPassword,
        newPassword,
      });
      if (updated) setProfile(updated);
      toast.success("Senha alterada com sucesso!");
      navigate("/");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("Sessão expirada", {
          description: "Faça login novamente para trocar a senha.",
        });
        navigate("/auth", { replace: true });
        return;
      }
      toast.error("Erro ao alterar senha", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-48 h-auto">
            <img src={engemaseLogo} alt="Engemase Engenharia" className="w-full h-auto" />
          </div>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Alterar Senha</CardTitle>
          <CardDescription>
            {isFirstLogin
              ? "Primeiro acesso. Crie uma senha com 8+ caracteres, maiúscula, minúscula e número."
              : "Mínimo: 8 caracteres com maiúscula, minúscula e número. Símbolo é opcional."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isFirstLogin && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${strength.color}`} />
                    <span
                      className={`text-xs font-medium min-w-[140px] text-right flex items-center justify-end gap-1 ${
                        strength.ok ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {strength.ok && <Check className="w-3.5 h-3.5" />}
                      {strength.label}
                    </span>
                  </div>

                  <ul className="space-y-1 pt-1">
                    {REQUIREMENTS.map((req) => {
                      const ok = req.test(newPassword);
                      return (
                        <li
                          key={req.label}
                          className={`flex items-center gap-2 text-xs transition-colors ${
                            ok
                              ? "text-primary"
                              : req.required
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {ok ? (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{req.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {strength.ok && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                      Evite senhas comuns, nomes próprios ou combinações já vazadas; elas ainda podem ser bloqueadas por segurança.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  className={`text-xs flex items-center gap-1.5 ${
                    passwordsMatch ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> As senhas coincidem
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" /> As senhas não coincidem
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isFirstLogin && (
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                  Voltar
                </Button>
              )}
              <Button
                type="submit"
                className={isFirstLogin ? "w-full" : "flex-1"}
                disabled={loading || !requiredRequirementsMet || !passwordsMatch}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
