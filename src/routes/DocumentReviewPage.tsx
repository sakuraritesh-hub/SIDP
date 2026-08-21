import { useCallback, useEffect, useState, Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileWarning,
  CircleCheck,
  Loader2,
  Trash2,
  ShieldAlert,
  Pencil,
  Check,
  X,
  RefreshCw,
  Save,
  Download,
} from "lucide-react";
import { ConfidenceDot, ConfidenceBadge } from "@/components/ConfidenceDot";
import { StatusPill } from "@/components/StatusPill";
import { UserBadge } from "@/components/UserBadge";
import {
  HEADER_LABELS,
  TOTALS_LABELS,
  ITEM_COLUMNS,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocumentHeader,
  type DocumentTotals,
  type SidpDocument,
  type LineItem,
  type DocType,
} from "@/lib/sidp/schema";
import { EXPORT_FORMATS, buildExport, downloadExport, type ExportFormatId } from "@/lib/sidp/exporters";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import clsx from "clsx";

function Field({
  label,
  value,
  score,
  active,
  onFocus,
}: {
  label: string;
  value: string | number | null;
  score?: number;
  active: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      onClick={onFocus}
      className={clsx(
        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
        active
          ? "border-[color:var(--color-sakura-rose)] bg-[color:var(--color-sakura-blush)]/12"
          : "border-transparent hover:bg-black/[0.03]",
      )}
    >
      <span className="text-xs text-slate-soft">{label}</span>
      <span className="flex items-center gap-2 font-tabular text-sm text-ink-navy">
        {value ?? <span className="text-slate-soft/60">—</span>}
        {score != null && <ConfidenceDot score={score} />}
      </span>
    </button>
  );
}

export function DocumentReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { idToken, isAdmin } = useAuth();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [doc, setDoc] = useState<SidpDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Local editable draft of header + doc type, saved together via the
  // toolbar's Save button. Reset from the server copy on load, and again
  // after a successful save or re-extract — never on a background poll,
  // so an admin's in-progress edits can't get silently clobbered.
  const [headerDraft, setHeaderDraft] = useState<DocumentHeader | null>(null);
  const [docTypeDraft, setDocTypeDraft] = useState<DocType | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaveError, setHeaderSaveError] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormatId>("xlsx");
  const [tallyCompanyName, setTallyCompanyName] = useState("Company");
  const [activeTab, setActiveTab] = useState<"source" | "mapping" | "notes">("source");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .getDocument(idToken, id)
      .then((data) => {
        const d = data as SidpDocument;
        setDoc(d);
        if (d.extracted) {
          setHeaderDraft(d.extracted.header);
          setDocTypeDraft(d.extracted.doc_type);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this document."))
      .finally(() => setLoading(false));
  }, [id, idToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while extraction is still running. Stops the instant extracted
  // data first appears, so this never fights with in-progress header edits.
  useEffect(() => {
    if (doc?.status !== "processing" && doc?.status !== "uploaded") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [doc?.status, load]);

  // Fetch the source file once, when the document has loaded.
  useEffect(() => {
    if (!id || !doc) return;
    let cancelled = false;
    setFileLoading(true);
    setFileError(null);
    api
      .getDocumentFile(idToken, id)
      .then(({ base64, mimeType }) => {
        if (cancelled) return;
        setFileUrl(`data:${mimeType};base64,${base64}`);
        setFileMimeType(mimeType);
      })
      .catch((err) => {
        if (!cancelled) setFileError(err instanceof ApiError ? err.message : "Couldn't load the source file.");
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!doc]);

  const approve = async () => {
    if (!id) return;
    setApproving(true);
    try {
      const updated = (await api.approveDocument(idToken, id)) as SidpDocument;
      setDoc(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve this document.");
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !doc) return;
    if (!confirm(`Move "${doc.file_name}" to Trash? You can restore it from there.`)) return;
    setDeleting(true);
    try {
      await api.deleteDocument(idToken, id);
      navigate("/queue");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this document.");
      setDeleting(false);
    }
  };

  const handleReextract = async () => {
    if (!id) return;
    if (!confirm("Re-run AI extraction on this document? This replaces the current extracted data with a fresh read.")) return;
    setReextracting(true);
    setError(null);
    try {
      const updated = (await api.reextractDocument(idToken, id)) as SidpDocument;
      setDoc(updated);
      if (updated.extracted) {
        setHeaderDraft(updated.extracted.header);
        setDocTypeDraft(updated.extracted.doc_type);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Re-extraction failed.");
    } finally {
      setReextracting(false);
    }
  };

  const saveHeader = async () => {
    if (!id || !doc?.extracted || !headerDraft) return;
    setSavingHeader(true);
    setHeaderSaveError(null);
    try {
      const updated = (await api.persistEdits(idToken, id, {
        field: "header",
        extracted: { header: headerDraft, doc_type: docTypeDraft },
      })) as SidpDocument;
      setDoc(updated);
      if (updated.extracted) {
        setHeaderDraft(updated.extracted.header);
        setDocTypeDraft(updated.extracted.doc_type);
      }
    } catch (err) {
      setHeaderSaveError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setSavingHeader(false);
    }
  };

  const handleExport = () => {
    if (!doc) return;
    const result = buildExport(exportFormat, [doc], { tallyCompanyName });
    downloadExport(result);
  };

  const startEditRate = (idx: number, currentRate: number | null) => {
    setEditingIdx(idx);
    setEditValue(currentRate != null ? String(currentRate) : "");
  };

  const cancelEditRate = () => {
    setEditingIdx(null);
    setEditValue("");
  };

  const saveRateEdit = async (idx: number) => {
    if (!id || !doc?.extracted) return;
    const parsed = Number(editValue);
    if (Number.isNaN(parsed)) {
      setEditError("Rate must be a number.");
      return;
    }

    const oldRate = doc.extracted.items[idx]?.rate ?? null;
    const correctedItems: LineItem[] = doc.extracted.items.map((item, i) => (i === idx ? { ...item, rate: parsed } : item));

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = (await api.persistEdits(idToken, id, {
        field: `items[${idx}].rate`,
        from: oldRate,
        to: parsed,
        extracted: { items: correctedItems },
      })) as SidpDocument;
      setDoc(updated);
      cancelEditRate();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Couldn't save that rate.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-soft">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8">
        <p className="text-sm text-[color:var(--color-conf-bad)]">{error ?? "Document not found."}</p>
      </div>
    );
  }

  const extracted = doc.extracted;
  const conf = (path: string) => doc.field_confidence?.[path];
  const isDirty =
    isAdmin &&
    !!extracted &&
    !!headerDraft &&
    (JSON.stringify(headerDraft) !== JSON.stringify(extracted.header) || docTypeDraft !== extracted.doc_type);

  const discrepancyCount = doc.rate_changes.filter((c) => c.previous_rate != null && c.previous_rate !== c.new_rate).length;
  const rateStats = {
    up: doc.rate_changes.filter((c) => c.previous_rate != null && c.new_rate > c.previous_rate).length,
    down: doc.rate_changes.filter((c) => c.previous_rate != null && c.new_rate < c.previous_rate).length,
    new: doc.rate_changes.filter((c) => c.previous_rate == null).length,
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-black/10 bg-panel px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/queue")} className="text-slate-soft hover:text-ink-navy">
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="font-display text-sm font-semibold text-ink-navy">{doc.file_name}</p>
              <p className="text-xs text-slate-soft">Correct anything the extractor got wrong — validation updates live</p>
            </div>
          </div>
          <UserBadge />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={doc.status} />

          <select
            value={docTypeDraft ?? extracted?.doc_type ?? "other"}
            disabled={!isAdmin || !extracted}
            onChange={(e) => setDocTypeDraft(e.target.value as DocType)}
            className={clsx(
              "rounded-md border px-2.5 py-1.5 text-sm outline-none",
              isAdmin ? "border-black/15 bg-white text-ink-navy" : "border-transparent bg-black/[0.03] text-slate-soft",
            )}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <ConfidenceBadge score={doc.overall_confidence} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormatId)}
              className="rounded-md border border-black/10 bg-panel px-2.5 py-2 text-xs text-slate-soft outline-none"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {exportFormat === "tally-xml" && (
              <input
                value={tallyCompanyName}
                onChange={(e) => setTallyCompanyName(e.target.value)}
                placeholder="Tally company name"
                className="w-36 rounded-md border border-black/10 px-2.5 py-2 text-xs outline-none"
              />
            )}
            <button
              onClick={handleExport}
              disabled={!extracted}
              title="Export this document"
              className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-slate-soft hover:border-black/20 hover:text-ink-navy disabled:opacity-50"
            >
              <Download className="size-3.5" />
              Export
            </button>

            {isAdmin && (
              <button
                onClick={handleReextract}
                disabled={reextracting || doc.status === "processing"}
                title="Re-run AI extraction"
                className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-slate-soft hover:border-black/20 hover:text-ink-navy disabled:opacity-50"
              >
                {reextracting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Re-extract
              </button>
            )}

            {isAdmin && (
              <button
                onClick={saveHeader}
                disabled={!isDirty || savingHeader}
                title="Save header field changes"
                className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-slate-soft hover:border-black/20 hover:text-ink-navy disabled:opacity-40"
              >
                {savingHeader ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Move to Trash"
              className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-2 text-xs text-slate-soft hover:border-[color:var(--color-conf-bad)]/40 hover:text-[color:var(--color-conf-bad)] disabled:opacity-60"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>

            <button
              onClick={approve}
              disabled={doc.status === "approved" || doc.status === "processing" || approving}
              className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-sakura-rose)] px-4 py-2 text-xs font-medium text-white hover:bg-[color:var(--color-sakura-rose-deep)] disabled:opacity-60"
            >
              {approving && <Loader2 className="size-3.5 animate-spin" />}
              {doc.status === "approved" ? "Approved" : "Approve"}
            </button>
          </div>
        </div>
        {headerSaveError && <p className="mt-2 text-xs text-[color:var(--color-conf-bad)]">{headerSaveError}</p>}
      </header>

      <div className="grid flex-1 grid-cols-[1fr_1.15fr] overflow-hidden">
        {/* Left: source preview, with Source / Mapping / OCR notes tabs */}
        <div className="flex flex-col overflow-hidden bg-deep-navy/95">
          <div className="flex items-center gap-1 border-b border-white/10 px-4 py-2">
            {(["source", "mapping", "notes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={clsx(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === t ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
                )}
              >
                {t === "source" ? "Source" : t === "mapping" ? "Mapping" : "OCR notes"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "source" && (
              <div className="flex h-full items-center justify-center">
                {fileLoading && (
                  <div className="flex flex-col items-center gap-3 text-white/40">
                    <Loader2 className="size-6 animate-spin" />
                    <p className="text-xs">Loading source file…</p>
                  </div>
                )}
                {!fileLoading && fileError && (
                  <div className="flex aspect-[3/4] w-full max-w-md flex-col items-center justify-center gap-3 rounded-md bg-white/5 p-6 text-center text-white/40">
                    <FileWarning className="size-8" />
                    <p className="text-xs">{fileError}</p>
                  </div>
                )}
                {!fileLoading && !fileError && fileUrl && fileMimeType?.startsWith("image/") && (
                  <img src={fileUrl} alt={doc.file_name} className="max-h-full max-w-full rounded-md object-contain shadow-lg" />
                )}
                {!fileLoading && !fileError && fileUrl && fileMimeType === "application/pdf" && (
                  <iframe src={fileUrl} title={doc.file_name} className="h-full w-full rounded-md bg-white" />
                )}
              </div>
            )}

            {activeTab === "mapping" && (
              <div className="rounded-md bg-white/5 p-4">
                <table className="w-full text-xs text-white/70">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-1.5 pr-3 font-medium">Source Column</th>
                      <th className="py-1.5 pr-3 font-medium">Mapped To</th>
                      <th className="py-1.5 text-right font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(extracted?.detected_headers ?? []).map((d, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="py-1.5 pr-3">{d.source}</td>
                        <td className="py-1.5 pr-3">{d.mapped_to}</td>
                        <td className="py-1.5 text-right font-tabular">{d.confidence}%</td>
                      </tr>
                    ))}
                    {(!extracted?.detected_headers || extracted.detected_headers.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-white/40">
                          No non-standard column mappings detected.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Corrections</p>
                  {(extracted?.corrections ?? []).length === 0 ? (
                    <p className="text-xs text-white/40">No OCR corrections were needed.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {extracted!.corrections.map((c, i) => (
                        <li key={i} className="text-xs text-white/70">
                          <span className="font-medium text-white">{c.field}</span>: "{c.from}" → "{c.to}" — {c.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Notes</p>
                  {(extracted?.notes ?? []).length === 0 ? (
                    <p className="text-xs text-white/40">No additional notes.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-4">
                      {extracted!.notes.map((n, i) => (
                        <li key={i} className="text-xs text-white/70">
                          {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: extracted data */}
        <div className="overflow-y-auto border-l border-black/10 bg-paper px-6 py-6">
          {!extracted ? (
            <p className="text-sm text-slate-soft">
              {doc.status === "processing" || doc.status === "uploaded"
                ? "Still processing — checking again automatically…"
                : doc.status === "failed"
                  ? (doc.error_message ?? "Extraction failed.")
                  : "No extracted data available."}
            </p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-soft">Validation</p>
                  {doc.validation && (
                    <p className="text-xs text-slate-soft">
                      {doc.validation.issues.filter((i) => i.severity === "error").length} errors ·{" "}
                      {doc.validation.issues.filter((i) => i.severity === "warning").length} warnings
                    </p>
                  )}
                </div>
                {!doc.validation || doc.validation.issues.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-[color:var(--color-conf-good)]">
                    <CircleCheck className="size-4" />
                    Everything reconciles.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {doc.validation.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CircleCheck
                          className={clsx(
                            "mt-0.5 size-4 shrink-0",
                            issue.severity === "error" && "text-[color:var(--color-conf-bad)]",
                            issue.severity === "warning" && "text-[color:var(--color-conf-warn)]",
                            issue.severity === "info" && "text-slate-soft",
                          )}
                        />
                        <span className="text-slate-soft">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-ink-navy">Rate changes vs last purchase</h2>
                  <p className="text-xs text-slate-soft">
                    {rateStats.up} up · {rateStats.down} down · {rateStats.new} new
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/10 text-left text-slate-soft">
                        <th className="py-1.5 pr-3 font-medium">Item</th>
                        <th className="py-1.5 pr-3 font-medium">UOM</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Previous Rate</th>
                        <th className="py-1.5 text-right font-medium">Current Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.rate_changes.map((c) => (
                        <tr key={c.item_key} className="border-b border-black/5 last:border-0">
                          <td className="py-1.5 pr-3 text-ink-navy">{c.item_name}</td>
                          <td className="py-1.5 pr-3 text-slate-soft">{c.uom ?? "—"}</td>
                          <td className="py-1.5 pr-3 text-right font-tabular text-slate-soft">
                            {c.previous_rate != null ? `₹${c.previous_rate.toFixed(2)}` : "—"}
                          </td>
                          <td
                            className={clsx(
                              "py-1.5 text-right font-tabular font-medium",
                              c.previous_rate == null
                                ? "text-[color:var(--color-sakura-rose-deep)]"
                                : c.new_rate > c.previous_rate
                                  ? "text-[color:var(--color-conf-bad)]"
                                  : c.new_rate < c.previous_rate
                                    ? "text-[color:var(--color-conf-good)]"
                                    : "text-ink-navy",
                            )}
                          >
                            ₹{c.new_rate.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {doc.rate_changes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-soft">
                            No line items to compare yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {discrepancyCount > 0 && (
                <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[color:var(--color-conf-warn)]/30 bg-amber-50 p-3.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[color:var(--color-conf-warn)]" />
                  <p className="text-sm text-ink-navy">
                    {isAdmin ? (
                      <>
                        {discrepancyCount} item{discrepancyCount === 1 ? "" : "s"} differ from the rate on record for this
                        supplier. Correct the reading in the table below if it's an OCR misread, or leave it if the price
                        genuinely changed.
                      </>
                    ) : (
                      <>
                        {discrepancyCount} item{discrepancyCount === 1 ? "" : "s"} differ from the rate on record for this
                        supplier. Only an admin can update the rate — they've been notified for significant changes.
                      </>
                    )}
                  </p>
                </div>
              )}

              <section>
                <h2 className="mb-2 font-display text-sm font-semibold text-ink-navy">Header fields</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(HEADER_LABELS) as (keyof DocumentHeader)[]).map((key) => {
                    const path = `header.${key}`;
                    const score = conf(path);
                    return (
                      <div key={key}>
                        <label className="mb-1 block text-xs text-slate-soft">{HEADER_LABELS[key]}</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            value={headerDraft?.[key] ?? ""}
                            disabled={!isAdmin}
                            onChange={(e) =>
                              setHeaderDraft((prev) => (prev ? { ...prev, [key]: e.target.value || null } : prev))
                            }
                            className={clsx(
                              "w-full rounded-md border px-2.5 py-1.5 text-sm font-tabular outline-none",
                              isAdmin
                                ? "border-black/15 bg-white focus:border-[color:var(--color-sakura-rose)]"
                                : "border-transparent bg-black/[0.03] text-slate-soft",
                            )}
                          />
                          {score != null && <ConfidenceDot score={score} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-ink-navy">Line Items</h2>
                </div>

                {editError && <p className="mb-2 text-xs text-[color:var(--color-conf-bad)]">{editError}</p>}

                <div className="overflow-x-auto rounded-md border border-black/10 bg-panel">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/10 text-left text-slate-soft">
                        {ITEM_COLUMNS.map((col) => (
                          <th key={col.key} className={clsx("px-2 py-2 font-medium", col.numeric && "text-right")}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extracted.items.map((item, idx) => {
                        const rateChange = doc.rate_changes.find(
                          (c) => c.item_name?.trim().toLowerCase() === item.item_name?.trim().toLowerCase(),
                        );
                        const isDiscrepancy = !!(rateChange && rateChange.previous_rate != null && rateChange.previous_rate !== rateChange.new_rate);
                        const isEditing = editingIdx === idx;

                        return (
                          <Fragment key={idx}>
                            <tr className={clsx("border-b border-black/5", !isDiscrepancy && "last:border-0")}>
                              {ITEM_COLUMNS.map((col) => {
                                const path = `items[${idx}].${col.key}`;
                                const score = conf(path);
                                const isRateCol = col.key === "rate";

                                if (isRateCol && isEditing) {
                                  return (
                                    <td key={col.key} className="px-2 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          autoFocus
                                          className="w-20 rounded border border-black/15 px-1.5 py-1 text-right font-tabular text-xs outline-none focus:border-[color:var(--color-sakura-rose)]"
                                        />
                                        <button
                                          onClick={() => saveRateEdit(idx)}
                                          disabled={savingEdit}
                                          title="Save"
                                          className="text-[color:var(--color-conf-good)] hover:opacity-70 disabled:opacity-40"
                                        >
                                          {savingEdit ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                        </button>
                                        <button
                                          onClick={cancelEditRate}
                                          disabled={savingEdit}
                                          title="Cancel"
                                          className="text-slate-soft hover:text-[color:var(--color-conf-bad)]"
                                        >
                                          <X className="size-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={col.key}
                                    onClick={() => setActiveField(path)}
                                    className={clsx(
                                      "cursor-pointer px-2 py-2 font-tabular",
                                      col.numeric && "text-right",
                                      activeField === path && "bg-[color:var(--color-sakura-blush)]/20",
                                      isRateCol && isDiscrepancy && "text-[color:var(--color-conf-warn)]",
                                    )}
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {score != null && score < 85 && <ConfidenceDot score={score} size="sm" />}
                                      {item[col.key] ?? "—"}
                                      {isRateCol && isAdmin && !isEditing && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditRate(idx, item.rate);
                                          }}
                                          title="Edit rate"
                                          className="text-slate-soft/50 hover:text-[color:var(--color-sakura-rose)]"
                                        >
                                          <Pencil className="size-3" />
                                        </button>
                                      )}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                            {isDiscrepancy && rateChange && (
                              <tr className="border-b border-black/5 bg-amber-50/60 last:border-0">
                                <td colSpan={ITEM_COLUMNS.length} className="px-2 py-1.5">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-conf-warn)]">
                                    <ShieldAlert className="size-3" />
                                    On record: ₹{rateChange.previous_rate!.toFixed(2)} (invoice {rateChange.previous_invoice_number ?? "—"}) →
                                    this document: ₹{rateChange.new_rate.toFixed(2)} ({(rateChange.change_percent ?? 0) > 0 ? "+" : ""}
                                    {(rateChange.change_percent ?? 0).toFixed(1)}%)
                                  </span>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h2 className="mb-2 font-display text-sm font-semibold text-ink-navy">Totals</h2>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(TOTALS_LABELS) as (keyof DocumentTotals)[])
                    .filter((k) => extracted.totals[k] != null)
                    .map((key) => {
                      const path = `totals.${key}`;
                      return (
                        <Field
                          key={key}
                          label={TOTALS_LABELS[key]}
                          value={extracted.totals[key]}
                          score={conf(path)}
                          active={activeField === path}
                          onFocus={() => setActiveField(path)}
                        />
                      );
                    })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
