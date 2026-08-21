import { useEffect, useState } from "react";
import { Loader2, Download, FileOutput } from "lucide-react";
import clsx from "clsx";
import { StatusPill } from "@/components/StatusPill";
import { UserBadge } from "@/components/UserBadge";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { EXPORT_FORMATS, buildExport, downloadExport, type ExportFormatId } from "@/lib/sidp/exporters";
import type { SidpDocument } from "@/lib/sidp/schema";

export function ExportCenterPage() {
  const { idToken } = useAuth();
  const [documents, setDocuments] = useState<SidpDocument[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormatId>("xlsx");
  const [tallyCompanyName, setTallyCompanyName] = useState("SIDP Company");

  const load = () => {
    setLoading(true);
    Promise.all([api.listDocuments(idToken, { status: "approved" }), api.listDocuments(idToken, { status: "exported" })])
      .then(([approved, exported]) => setDocuments([...(approved as SidpDocument[]), ...(exported as SidpDocument[])]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load documents."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const activeFormat = EXPORT_FORMATS.find((f) => f.id === format)!;

  const runExport = async () => {
    const docs = documents.filter((d) => selected.has(d.id));
    if (docs.length === 0) return;
    setExporting(true);

    try {
      const result = buildExport(format, docs, { tallyCompanyName });
      downloadExport(result);

      // Mark newly-exported (was "approved") docs as exported on the backend.
      const toMarkIds = docs.filter((d) => d.status === "approved").map((d) => d.id);
      if (toMarkIds.length > 0) {
        await api.exportDocuments(idToken, toMarkIds);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
      setSelected(new Set());
      load();
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-navy">Export Center</h1>
          <p className="mt-1 text-sm text-slate-soft">Push approved documents into Tally, ERP or spreadsheets</p>
        </div>
        <UserBadge />
      </header>

      {loading && <Loader2 className="size-5 animate-spin text-slate-soft" />}
      {error && <p className="text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-[1fr_340px] gap-4">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-3.5">
              <h2 className="font-display text-sm font-semibold text-ink-navy">Approved documents</h2>
              <p className="text-xs text-slate-soft">
                {selected.size} of {documents.length} selected
              </p>
            </div>
            <div>
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className="flex cursor-pointer items-center justify-between border-b border-black/5 px-5 py-3.5 last:border-0 hover:bg-black/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} />
                    <div>
                      <p className="text-sm font-medium text-ink-navy">{doc.supplier_name ?? "—"}</p>
                      <p className="text-xs text-slate-soft">
                        {doc.invoice_number ?? "—"} · {doc.invoice_date ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-tabular text-sm text-ink-navy">
                      {doc.grand_total != null ? `₹${doc.grand_total.toFixed(2)}` : "—"}
                    </span>
                    <StatusPill status={doc.status} />
                  </div>
                </label>
              ))}
              {documents.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-soft">
                  <FileOutput className="mx-auto mb-2 size-6 text-slate-soft/60" />
                  Nothing approved yet — approve documents from the review screen first.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-4">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink-navy">Format</h2>
              <div className="space-y-2">
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={clsx(
                      "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                      format === f.id
                        ? "border-[color:var(--color-sakura-rose)] bg-[color:var(--color-sakura-blush)]/12"
                        : "border-black/10 hover:bg-black/[0.02]",
                    )}
                  >
                    <p className="text-sm font-medium text-ink-navy">{f.label}</p>
                    <p className="text-xs text-slate-soft">{f.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {format === "tally-xml" && (
              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-4">
                <label className="text-xs font-medium text-slate-soft">Tally company name</label>
                <input
                  value={tallyCompanyName}
                  onChange={(e) => setTallyCompanyName(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-[color:var(--color-sakura-rose)]"
                />
                <p className="mt-1.5 text-xs text-slate-soft">Must match the company name in Tally for the voucher import to bind.</p>
              </div>
            )}

            <button
              onClick={runExport}
              disabled={selected.size === 0 || exporting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--color-sakura-rose)] py-3 text-sm font-medium text-white hover:bg-[color:var(--color-sakura-rose-deep)] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export as {activeFormat.label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
