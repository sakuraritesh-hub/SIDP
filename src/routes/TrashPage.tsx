import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RotateCcw, Trash2, Trash } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { SidpDocument } from "@/lib/sidp/schema";

export function TrashPage() {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SidpDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .listDocuments(idToken, { deleted: true })
      .then((data) => setDocuments(data as SidpDocument[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load Trash."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const restore = async (doc: SidpDocument) => {
    setBusyId(doc.id);
    try {
      await api.restoreDocument(idToken, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't restore this document.");
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (doc: SidpDocument) => {
    if (!confirm(`Permanently delete "${doc.file_name}"? This can't be undone from SIDP — the source file goes to your Google Drive trash.`)) return;
    setBusyId(doc.id);
    try {
      await api.permanentlyDeleteDocument(idToken, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't permanently delete this document.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-navy">Trash</h1>
      <p className="mt-1 text-sm text-slate-soft">
        Documents removed from the queue. Restore them, or delete permanently — that step can't be undone from here.
      </p>

      {loading && <Loader2 className="mt-8 size-5 animate-spin text-slate-soft" />}
      {error && <p className="mt-4 text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Deleted</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/[0.02]" onClick={() => navigate(`/documents/${doc.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-navy">
                      {doc.invoice_number ?? doc.challan_number ?? doc.po_number ?? doc.file_name}
                    </div>
                    <div className="text-xs text-slate-soft">{doc.file_name}</div>
                  </td>
                  <td className="px-4 py-3">{doc.supplier_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={doc.status} />
                  </td>
                  <td className="px-4 py-3 font-tabular text-slate-soft">
                    {doc.deleted_at ? new Date(doc.deleted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                      {busyId === doc.id ? (
                        <Loader2 className="size-4 animate-spin text-slate-soft" />
                      ) : (
                        <>
                          <button onClick={() => restore(doc)} title="Restore" className="text-slate-soft/70 hover:text-[color:var(--color-conf-good)]">
                            <RotateCcw className="size-4" />
                          </button>
                          <button onClick={() => permanentlyDelete(doc)} title="Delete permanently" className="text-slate-soft/70 hover:text-[color:var(--color-conf-bad)]">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-soft">
                    <Trash className="mx-auto mb-2 size-6 text-slate-soft/60" />
                    Trash is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
