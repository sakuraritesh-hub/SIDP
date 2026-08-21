import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Upload, Loader2, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { ConfidenceBadge } from "@/components/ConfidenceDot";
import { DOC_TYPE_LABELS, type SidpDocument } from "@/lib/sidp/schema";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

function formatInr(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<SidpDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploaderFilter, setUploaderFilter] = useState("all");
  const navigate = useNavigate();
  const { idToken, isAdmin } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listDocuments(idToken, query.trim() ? { q: query.trim() } : undefined)
      .then((data) => {
        if (!cancelled) setDocuments(data as SidpDocument[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch on search too — the backend does the filtering.
  }, [idToken, query]);

  // Admins see every user's documents in one list — this lets them narrow
  // to a single uploader. Regular users only ever get their own documents
  // back from the backend, so this filter is invisible/moot for them.
  const uploaders = useMemo(() => Array.from(new Set(documents.map((d) => d.user_id))).sort(), [documents]);
  const visibleDocuments = useMemo(
    () => (uploaderFilter === "all" ? documents : documents.filter((d) => d.user_id === uploaderFilter)),
    [documents, uploaderFilter],
  );

  const needsReview = visibleDocuments.filter((d) => d.status === "review").length;

  const handleDelete = async (e: React.MouseEvent, doc: SidpDocument) => {
    e.stopPropagation();
    if (!confirm(`Move "${doc.file_name}" to Trash? You can restore it from there.`)) return;
    try {
      await api.deleteDocument(idToken, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this document.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-navy">Document Queue</h1>
          <p className="mt-1 text-sm text-slate-soft">
            {loading ? (
              "Loading…"
            ) : needsReview > 0 ? (
              <>
                <span className="font-medium text-[color:var(--color-conf-warn)]">{needsReview}</span> document
                {needsReview === 1 ? "" : "s"} waiting on review
              </>
            ) : (
              "Everything's caught up."
            )}
          </p>
        </div>
        <button
          onClick={() => navigate("/upload")}
          className="flex items-center gap-2 rounded-md bg-[color:var(--color-sakura-rose)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[color:var(--color-sakura-rose-deep)]"
        >
          <Upload className="size-4" />
          Upload document
        </button>
      </header>

      <div className="mb-4 flex items-center gap-3">
        {isAdmin && uploaders.length > 1 && (
          <select
            value={uploaderFilter}
            onChange={(e) => setUploaderFilter(e.target.value)}
            className="rounded-md border border-black/10 bg-panel px-3 py-2.5 text-sm text-ink-navy outline-none"
          >
            <option value="all">All users</option>
            {uploaders.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        <div className="flex flex-1 items-center gap-2 rounded-md border border-black/10 bg-panel px-3 py-2">
          <Search className="size-4 text-slate-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by supplier, invoice no., PO no..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-soft/70"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-conf-bad)]/30 bg-red-50 px-4 py-3 text-sm text-[color:var(--color-conf-bad)]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Uploaded By</th>}
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-sm text-slate-soft">
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                  Loading documents…
                </td>
              </tr>
            )}
            {!loading &&
              visibleDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-navy">
                      {doc.invoice_number ?? doc.challan_number ?? doc.po_number ?? doc.file_name}
                    </div>
                    <div className="text-xs text-slate-soft">{doc.file_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-soft">{doc.doc_type ? DOC_TYPE_LABELS[doc.doc_type] : "—"}</td>
                  <td className="px-4 py-3">{doc.supplier_name ?? "—"}</td>
                  {isAdmin && <td className="px-4 py-3 text-slate-soft">{doc.user_id}</td>}
                  <td className="px-4 py-3 font-tabular text-slate-soft">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right font-tabular">{formatInr(doc.grand_total)}</td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={doc.overall_confidence} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={doc.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => handleDelete(e, doc)}
                      title="Move to Trash"
                      className="text-slate-soft/60 hover:text-[color:var(--color-conf-bad)]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && !error && visibleDocuments.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-sm text-slate-soft">
                  {query ? `No documents match "${query}".` : "No documents yet — upload your first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
