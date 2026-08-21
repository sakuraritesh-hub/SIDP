import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  UploadCloud,
  ListChecks,
  FileOutput,
  TrendingUp,
  Building2,
  ScrollText,
  Settings,
  ScanLine,
  LogOut,
  Trash2,
  Package,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth/AuthContext";

const ADMIN_NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/upload", label: "Upload Center", icon: UploadCloud },
  { to: "/queue", label: "Document Queue", icon: ListChecks },
  { to: "/export", label: "Export Center", icon: FileOutput },
  { to: "/rates", label: "Rate Tracking", icon: TrendingUp },
  { to: "/items", label: "Item Master", icon: Package },
  { to: "/vendors", label: "Vendor Learning", icon: Building2 },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/trash", label: "Trash", icon: Trash2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

// Regular users only upload and check on their own documents (including
// any rate-discrepancy flags) — everything else (dashboard-wide stats,
// exports, vendor memory, audit trail, trash, settings) is admin-only, both
// here and enforced again server-side via role checks / RequireAdmin.
const USER_NAV_ITEMS = [
  { to: "/upload", label: "Upload Center", icon: UploadCloud, end: false },
  { to: "/queue", label: "Document Queue", icon: ListChecks, end: false },
];

function UserFooter() {
  const { user, role, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2.5">
      {user.picture ? (
        <img src={user.picture} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs">
          {user.email?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/90">{user.name || user.email}</p>
        {role && (
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {role === "admin" ? "Admin" : "Viewer"}
          </p>
        )}
      </div>
      <button onClick={logout} title="Sign out" className="text-white/40 hover:text-white/80">
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}

export function AppShell() {
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 shrink-0 flex-col bg-ink-navy text-white/90">
        <div className="flex items-center gap-2 px-5 py-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[color:var(--color-sakura-rose)]">
            <ScanLine className="size-4 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-white">SIDP</p>
            <p className="text-[11px] text-white/50">Document Intelligence</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-white/10 px-5 py-4">
          <UserFooter />
          <p className="text-[11px] text-white/30">Sakura Business Suite</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
