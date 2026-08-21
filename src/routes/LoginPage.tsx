import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export function LoginPage() {
  const { idToken, ready, login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (idToken) navigate("/", { replace: true });
  }, [idToken, navigate]);

  useEffect(() => {
    if (!ready || !buttonRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => login(response.credential),
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: 280,
      text: "continue_with",
    });
  }, [ready, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-navy px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-panel p-8 text-center shadow-xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color:var(--color-sakura-blush)]/40">
          <ScanLine className="size-6 text-[color:var(--color-sakura-rose-deep)]" />
        </div>
        <h1 className="mt-4 font-display text-lg font-semibold text-ink-navy">Sakura Intelligent Document Processing</h1>
        <p className="mt-1.5 text-sm text-slate-soft">Sign in with your Sakura Google account to continue.</p>

        <div className="mt-6 flex justify-center">
          {ready ? <div ref={buttonRef} /> : <p className="text-xs text-slate-soft">Loading sign-in…</p>}
        </div>
      </div>
    </div>
  );
}
