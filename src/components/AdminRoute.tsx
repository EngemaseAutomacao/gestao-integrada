import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Só renderiza as rotas filhas para administradores; os demais voltam ao início. */
export function AdminRoute() {
  const { profile } = useAuth();
  if (profile?.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
