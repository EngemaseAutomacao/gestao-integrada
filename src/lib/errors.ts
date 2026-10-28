import { ApiError } from "@/lib/api";

/**
 * Converte erros da API/rede em mensagens amigáveis em português.
 * Erros da API própria (ApiError) já chegam com mensagem pronta para o usuário.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("duplicate key")) return "Este registro já existe";
  if (msg.includes("foreign key") || msg.includes("violates foreign key"))
    return "Existem registros vinculados que impedem esta ação";
  if (msg.includes("permission denied") || msg.includes("RLS") || msg.includes("row-level security"))
    return "Você não tem permissão para esta ação";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("net::"))
    return "Sem conexão. Verifique sua internet";
  if (msg.includes("JWT expired") || msg.includes("token is expired"))
    return "Sua sessão expirou. Faça login novamente";
  if (msg.includes("23505")) return "Este registro já existe";
  if (msg.includes("23503")) return "Existem registros vinculados";
  if (msg.includes("PGRST")) return "Erro ao acessar os dados. Tente novamente";

  return "Ocorreu um erro. Tente novamente";
}
