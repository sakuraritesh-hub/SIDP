import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

export function RequireAuth() {
  const { idToken } = useAuth();
  if (!idToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
