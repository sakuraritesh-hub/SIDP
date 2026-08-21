import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { decodeJwtPayload } from "./jwt";
import { api } from "@/lib/api/client";

interface SidpUser {
  email: string;
  name: string;
  picture: string;
}

type Role = "admin" | "user";

interface AuthContextValue {
  idToken: string | null;
  user: SidpUser | null;
  role: Role | null; // null until the backend has confirmed it — don't assume "user" during that gap
  isAdmin: boolean;
  ready: boolean; // Google Identity Services script has loaded
  login: (idToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "sidp_id_token";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

function isExpired(token: string): boolean {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && !isExpired(stored) ? stored : null;
  });
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const check = setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true);
        clearInterval(check);
      }
    }, 100);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!ready || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => login(response.credential),
      auto_select: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Role is decided server-side (CONFIG.ADMIN_EMAILS) — fetch it once per
  // sign-in rather than trusting anything client-side, since edit
  // permissions hinge on it.
  useEffect(() => {
    if (!idToken) {
      setRole(null);
      return;
    }
    let cancelled = false;
    api
      .getMe(idToken)
      .then((me) => {
        if (!cancelled) setRole(me.role);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const login = useCallback((token: string) => {
    localStorage.setItem(STORAGE_KEY, token);
    setIdToken(token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIdToken(null);
    setRole(null);
    window.google?.accounts.id.disableAutoSelect();
  }, []);

  const user = idToken ? decodeJwtPayload<SidpUser>(idToken) : null;

  return (
    <AuthContext.Provider value={{ idToken, user, role, isAdmin: role === "admin", ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
