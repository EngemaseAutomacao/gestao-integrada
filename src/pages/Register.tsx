import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import engemaseLogo from "@/assets/engemase-logo.png";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [category, setCategory] = useState<"engemase_employee" | "third_party">("engemase_employee");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate full name
    if (!fullName.trim() || fullName.trim().length < 2 || fullName.length > 100) {
      toast.error("O nome completo deve ter entre 2 e 100 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (password.length > 128) {
      toast.error("A senha deve ter no máximo 128 caracteres");
      return;
    }

    if (!username.trim()) {
      toast.error("O nome de usuário é obrigatório");
      return;
    }

    // Check if username contains only valid characters and length
    const usernameRegex = /^[a-z0-9.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      toast.error("O nome de usuário deve ter 3-30 caracteres (letras minúsculas, números e ponto)");
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(username.toLowerCase().trim(), password, fullName.trim(), category);

      if (error) {
        toast.error("Erro ao criar conta", {
          description: error.message,
        });
      } else {
        toast.success("Conta criada com sucesso!", {
          description: "Aguarde a aprovação de um administrador para acessar o sistema.",
        });
        navigate("/auth");
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
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-48 h-auto">
            <img src={engemaseLogo} alt="Engemase Engenharia" className="w-full h-auto" />
          </div>
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>
            Preencha os dados para solicitar acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="nome.sobrenome"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '.'))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Este será usado para fazer login
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={(value: "engemase_employee" | "third_party") => setCategory(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engemase_employee">Funcionário Engemase</SelectItem>
                  <SelectItem value="third_party">Terceirizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Conta
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Fazer login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
