import { useAuth } from "@/lib/auth/AuthContext";

export function UserBadge() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <button
      onClick={logout}
      title="Sign out"
      className="rounded-md border border-black/10 bg-panel px-3 py-2 text-xs font-medium text-slate-soft hover:border-black/20 hover:text-ink-navy"
    >
      {user.email}
    </button>
  );
}
