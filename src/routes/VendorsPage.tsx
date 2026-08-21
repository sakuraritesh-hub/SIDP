import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceDot";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Vendor } from "@/lib/sidp/schema";

export function VendorsPage() {
  const { idToken } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listVendors(idToken)
      .then((data) => setVendors(data as Vendor[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load vendors."))
      .finally(() => setLoading(false));
  }, [idToken]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-navy">Vendors</h1>
      <p className="mt-1 text-sm text-slate-soft">
        Every supplier SIDP has seen — header mappings and item names it has learned get reused automatically on the
        next document from them.
      </p>

      {loading && <Loader2 className="mt-8 size-5 animate-spin text-slate-soft" />}
      {error && <p className="mt-4 text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 space-y-2">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-[var(--radius-card)] border border-black/10 bg-panel px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[color:var(--color-sakura-blush)]/40 text-[color:var(--color-sakura-rose-deep)]">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-navy">{v.supplier_name}</p>
                  <p className="text-xs text-slate-soft">{v.document_count} documents processed</p>
                </div>
              </div>
              <ConfidenceBadge score={v.avg_confidence} />
            </div>
          ))}
          {vendors.length === 0 && <p className="text-sm text-slate-soft">No vendors learned yet — upload a document to get started.</p>}
        </div>
      )}
    </div>
  );
}
