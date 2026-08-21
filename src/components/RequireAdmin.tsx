import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export function RequireAdmin() {
  const { role } = useAuth();

  // role is null until auth.me resolves — show a brief loading state
  // rather than bouncing the user before we actually know their role.
  if (role === null) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-soft">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (role !== "admin") return <Navigate to="/upload" replace />;
  return <Outlet />;
}
