import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Loader2 } from "lucide-react";
import { UserBadge } from "@/components/UserBadge";
import { StatusPill } from "@/components/StatusPill";
import { ConfidenceBadge } from "@/components/ConfidenceDot";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { DOC_TYPE_LABELS, type DocStatus, type SidpDocument, type Vendor } from "@/lib/sidp/schema";
import clsx from "clsx";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, caption }: { label: string; value: string | number; caption: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-soft">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink-navy">{value}</p>
      <p className="mt-1 text-xs text-slate-soft">{caption}</p>
    </div>
  );
}

const PIPELINE_ORDER: DocStatus[] = ["uploaded", "processing", "review", "approved", "exported", "failed"];

export function DashboardPage() {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SidpDocument[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.listDocuments(idToken), api.listVendors(idToken)])
      .then(([docs, vends]) => {
        setDocuments(docs as SidpDocument[]);
        setVendors(vends as Vendor[]);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the dashboard."))
      .finally(() => setLoading(false));
  }, [idToken]);

  const stats = useMemo(() => {
    const awaitingReview = documents.filter((d) => d.status === "review");
    const withValidationErrors = documents.filter((d) => d.validation?.issues.some((i) => i.severity === "error"));
    const confidences = documents.map((d) => d.overall_confidence).filter((n): n is number => n != null);
    const avgConfidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null;

    const pipeline = Object.fromEntries(PIPELINE_ORDER.map((s) => [s, 0])) as Record<DocStatus, number>;
    documents.forEach((d) => (pipeline[d.status] = (pipeline[d.status] || 0) + 1));

    const mixCounts = new Map<string, number>();
    documents.forEach((d) => {
      const label = d.doc_type ? DOC_TYPE_LABELS[d.doc_type] : "Unclassified";
      mixCounts.set(label, (mixCounts.get(label) || 0) + 1);
    });
    const docMix = Array.from(mixCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    const maxMix = docMix.length ? docMix[0].count : 1;

    const capturedValue = documents.reduce((sum, d) => sum + (d.grand_total || 0), 0);

    return {
      documentsProcessed: documents.length,
      awaitingReview: awaitingReview.length,
      withValidationErrors: withValidationErrors.length,
      avgConfidence,
      vendorsLearned: vendors.length,
      pipeline,
      docMix,
      maxMix,
      capturedValue,
    };
  }, [documents, vendors]);

  const recent = documents.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-navy">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-soft">Processing throughput, confidence and exceptions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 rounded-md bg-[color:var(--color-sakura-rose)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[color:var(--color-sakura-rose-deep)]"
          >
            <Upload className="size-4" />
            Upload
          </button>
          <UserBadge />
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 py-12 text-slate-soft">
          <Loader2 className="size-5 animate-spin" />
          Loading dashboard…
        </div>
      )}
      {error && <p className="text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Documents Processed" value={stats.documentsProcessed} caption="Last 500 records" />
            <StatCard
              label="Awaiting Review"
              value={stats.awaitingReview}
              caption={`${stats.withValidationErrors} with validation errors`}
            />
            <StatCard
              label="Average Confidence"
              value={stats.avgConfidence != null ? `${stats.avgConfidence}%` : "—"}
              caption="Across all extracted documents"
            />
            <StatCard label="Vendors Learned" value={stats.vendorsLearned} caption="Layout memory profiles" />
          </div>

          <div className="mt-6 grid grid-cols-[1fr_360px] gap-4">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                <h2 className="font-display text-sm font-semibold text-ink-navy">Recent documents</h2>
                <button onClick={() => navigate("/queue")} className="text-xs font-medium text-[color:var(--color-sakura-rose-deep)] hover:underline">
                  View queue
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
                    <th className="px-5 py-2.5 font-medium">Supplier</th>
                    <th className="px-5 py-2.5 font-medium">Invoice</th>
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total</th>
                    <th className="px-5 py-2.5 font-medium">Conf.</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
                    >
                      <td className="px-5 py-3 font-medium text-ink-navy">{doc.supplier_name ?? "—"}</td>
                      <td className="px-5 py-3 font-tabular text-slate-soft">
                        {doc.invoice_number ?? doc.challan_number ?? doc.po_number ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-soft">{doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "—"}</td>
                      <td className="px-5 py-3 text-right font-tabular">
                        {doc.grand_total != null ? formatInr(doc.grand_total) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <ConfidenceBadge score={doc.overall_confidence} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={doc.status} />
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-soft">
                        No documents yet — upload your first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
                <h2 className="mb-3 font-display text-sm font-semibold text-ink-navy">Pipeline state</h2>
                <div className="space-y-2">
                  {PIPELINE_ORDER.map((status) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <StatusPill status={status} />
                      <span className="font-tabular font-medium text-ink-navy">{stats.pipeline[status]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
                <h2 className="mb-3 font-display text-sm font-semibold text-ink-navy">Document mix</h2>
                <div className="space-y-3">
                  {stats.docMix.map(({ label, count }) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-ink-navy">{label}</span>
                        <span className="font-tabular text-slate-soft">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div
                          className="h-full rounded-full bg-[color:var(--color-sakura-rose)]"
                          style={{ width: `${(count / stats.maxMix) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {stats.docMix.length === 0 && <p className="text-sm text-slate-soft">No documents yet.</p>}
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
                <h2 className="mb-2 font-display text-sm font-semibold text-ink-navy">Captured value</h2>
                <p className={clsx("font-tabular text-2xl font-semibold text-[color:var(--color-sakura-rose)]")}>
                  {formatInr(stats.capturedValue)}
                </p>
                <p className="mt-1 text-xs text-slate-soft">Sum of grand totals across extracted documents.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
