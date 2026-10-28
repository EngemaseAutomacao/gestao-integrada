import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Loader2, Pencil, Trash2, Key, CheckCircle, Clock, RefreshCw, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { PasswordStrengthField, passwordMeetsRequirements } from "@/components/PasswordStrengthField";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  category: "engemase_employee" | "third_party" | "socios";
  role: "admin" | "employee" | "third_party";
  approved: boolean;
  first_login: boolean;
  company: string | null;
}

export default function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    category: "engemase_employee" as "engemase_employee" | "third_party" | "socios",
    role: "employee" as "admin" | "employee" | "third_party",
  });
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    company: "",
    category: "engemase_employee" as "engemase_employee" | "third_party" | "socios",
    role: "employee" as "admin" | "employee" | "third_party",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  const loadUsers = async () => {
    try {
      const data = await api.get<Profile[]>("/users");
      setUsers(data);
    } catch (error: any) {
      toast.error("Erro ao carregar usuários", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (formData.fullName.trim().length < 2 || formData.fullName.length > 100) {
      toast.error("Nome completo deve ter entre 2 e 100 caracteres");
      return;
    }

    const usernameRegex = /^[a-z0-9.]{3,30}$/;
    if (!usernameRegex.test(formData.username)) {
      toast.error("Nome de usuário deve ter 3-30 caracteres (letras minúsculas, números e ponto)");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email) || formData.email.length > 255) {
      toast.error("Formato de email inválido");
      return;
    }

    if (formData.password.length < 8 || formData.password.length > 128) {
      toast.error("A senha deve ter entre 8 e 128 caracteres");
      return;
    }

    setLoading(true);

    try {
      await api.post("/users", {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName.trim(),
        username: formData.username,
        category: formData.category,
        role: formData.role,
      });

      toast.success("Usuário criado com sucesso!");
      setDialogOpen(false);
      setFormData({
        email: "",
        password: "",
        fullName: "",
        username: "",
        category: "engemase_employee",
        role: "employee",
      });
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao criar usuário", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = (user: Profile) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.full_name,
      email: user.email,
      username: user.username || "",
      company: user.company || "",
      category: user.category,
      role: user.role,
    });
    setEditDialogOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);

    try {
      await api.patch(`/users/${selectedUser.id}`, {
        fullName: editFormData.fullName,
        email: editFormData.email,
        username: editFormData.username,
        category: editFormData.category,
        role: editFormData.role,
        company: editFormData.company,
      });

      toast.success("Usuário atualizado com sucesso!");
      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      const result = await api.delete<{ deactivated: boolean }>(`/users/${userId}`);

      toast.success(
        result.deactivated
          ? "Usuário desativado (o histórico de retiradas foi preservado)."
          : "Usuário excluído com sucesso!",
      );
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao excluir usuário", {
        description: error.message,
      });
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/approve`);

      toast.success("Usuário aprovado com sucesso!");
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao aprovar usuário", { description: error.message });
    }
  };

  const handleToggleFirstLogin = async (userId: string, currentValue: boolean) => {
    try {
      await api.patch(`/users/${userId}/first-login`, { first_login: !currentValue });

      toast.success(!currentValue ? "Troca de senha ativada" : "Troca de senha desativada");
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar", { description: error.message });
    }
  };
  const handleOpenPasswordDialog = (user: Profile) => {
    setSelectedUser(user);
    setNewPassword("");
    setPasswordError("");
    setPasswordDialogOpen(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    const passwordSchema = z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(128, "A senha deve ter no máximo 128 caracteres");
    const validation = passwordSchema.safeParse(newPassword);

    if (!validation.success) {
      setPasswordError(validation.error.errors[0].message);
      return;
    }

    if (!passwordMeetsRequirements(newPassword)) {
      setPasswordError("A senha precisa ter 8+ caracteres, maiúscula, minúscula e número");
      return;
    }

    if (!selectedUser) return;

    setLoading(true);

    try {
      // O servidor encerra as sessões do usuário e exige nova troca no próximo acesso.
      await api.post(`/users/${selectedUser.id}/password`, { newPassword });

      toast.success(`Senha de ${selectedUser.full_name} alterada com sucesso!`);
      setPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (error: any) {
      const message = error?.message || "Ocorreu um erro ao alterar a senha";
      setPasswordError(message);
      toast.error("Erro ao alterar senha", {
        description: message,
      });
    } finally {
      setLoading(false);
    }

  };

  const getCategoryBadge = (category: string) => {
    if (category === "engemase_employee") {
      return <Badge className="bg-badge-employee text-badge-employee-foreground">Funcionário</Badge>;
    }
    if (category === "socios") {
      return <Badge className="bg-primary text-primary-foreground">Sócio</Badge>;
    }
    return <Badge className="bg-badge-thirdparty text-badge-thirdparty-foreground">Terceirizado</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      admin: "bg-destructive text-destructive-foreground",
      employee: "bg-primary text-primary-foreground",
      third_party: "bg-secondary text-secondary-foreground",
    };

    const labels: Record<string, string> = {
      admin: "Admin",
      employee: "Funcionário",
      third_party: "Terceirizado",
    };

    return <Badge className={variants[role]}>{labels[role]}</Badge>;
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 sm:gap-6">
      <AdminPageHero icon={Users} title="Gerenciar Usuários" subtitle="Administre usuários e permissões" />
      <div className="shrink-0 flex justify-end gap-3 flex-wrap">
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Adicione um novo usuário ao sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="usuario.sobrenome"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: "engemase_employee" | "third_party" | "socios") =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engemase_employee">Funcionário Engemase</SelectItem>
                    <SelectItem value="third_party">Terceirizado</SelectItem>
                    <SelectItem value="socios">Sócio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "admin" | "employee" | "third_party") =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                    <SelectItem value="third_party">Terceirizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Usuário
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>Total: {users.length} usuários</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead>Nome</TableHead>
                       <TableHead>Email</TableHead>
                       <TableHead>Categoria</TableHead>
                       <TableHead>Empresa</TableHead>
                       <TableHead>Função</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead>Troca de Senha</TableHead>
                       <TableHead className="text-right">Ações</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                         <TableCell>{getCategoryBadge(user.category)}</TableCell>
                         <TableCell>{user.company || "—"}</TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                         <TableCell>
                           {user.approved ? (
                             <Badge className="bg-green-500/10 text-green-600 gap-1">
                               <CheckCircle className="w-3 h-3" />
                               Aprovado
                             </Badge>
                           ) : (
                             <Badge className="bg-yellow-500/10 text-yellow-600 gap-1">
                               <Clock className="w-3 h-3" />
                               Pendente
                             </Badge>
                           )}
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <Switch
                               checked={user.first_login}
                               onCheckedChange={() => handleToggleFirstLogin(user.id, user.first_login)}
                             />
                             <span className="text-xs text-muted-foreground">
                               {user.first_login ? "Ativa" : "Inativa"}
                             </span>
                           </div>
                         </TableCell>
                         <TableCell className="text-right">
                           <div className="flex justify-end gap-2">
                              {!user.approved && (
                                <Button variant="ghost" size="sm" onClick={() => handleApproveUser(user.id)} title="Aprovar usuário" className="text-green-600 hover:text-green-700">
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                             <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(user)} title="Editar usuário">
                               <Pencil className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordDialog(user)} title="Alterar senha">
                               <Key className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)} disabled={user.id === profile.id} title="Excluir usuário">
                               <Trash2 className="w-4 h-4 text-destructive" />
                             </Button>
                           </div>
                         </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{user.full_name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        {user.approved ? (
                          <Badge className="bg-green-500/10 text-green-600 text-xs shrink-0">Aprovado</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/10 text-yellow-600 text-xs shrink-0">Pendente</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                         {getCategoryBadge(user.category)}
                         {user.company && <Badge variant="outline" className="text-xs">{user.company}</Badge>}
                         {getRoleBadge(user.role)}
                       </div>
                       <div className="flex items-center justify-between mt-2 pt-2 border-t">
                         <div className="flex items-center gap-2">
                           <Switch
                             checked={user.first_login}
                             onCheckedChange={() => handleToggleFirstLogin(user.id, user.first_login)}
                           />
                           <span className="text-xs text-muted-foreground">
                             Forçar troca de senha: {user.first_login ? "Ativa" : "Inativa"}
                           </span>
                         </div>
                       </div>
                       <div className="flex justify-end gap-1 mt-2 pt-2 border-t">
                        {!user.approved && (
                          <Button variant="ghost" size="sm" onClick={() => handleApproveUser(user.id)} className="text-green-600">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(user)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordDialog(user)}>
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)} disabled={user.id === profile.id}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog para editar usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados de {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName">Nome Completo *</Label>
              <Input
                id="editFullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editUsername">Nome de Usuário *</Label>
              <Input
                id="editUsername"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editCompany">Empresa</Label>
              <Input
                id="editCompany"
                value={editFormData.company}
                onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                placeholder="Nome da empresa (terceirizados)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editCategory">Categoria *</Label>
              <Select
                value={editFormData.category}
                onValueChange={(value: "engemase_employee" | "third_party" | "socios") =>
                  setEditFormData({ ...editFormData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engemase_employee">Funcionário Engemase</SelectItem>
                  <SelectItem value="third_party">Terceirizado</SelectItem>
                  <SelectItem value="socios">Sócio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRole">Função *</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value: "admin" | "employee" | "third_party") =>
                  setEditFormData({ ...editFormData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                  <SelectItem value="third_party">Terceirizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para alterar senha */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha do Usuário</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha *</Label>
              <PasswordStrengthField
                id="newPassword"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Digite a nova senha (mínimo 8 caracteres)"
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPasswordDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
