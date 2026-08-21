import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

interface AuditLogEntry {
  id: string;
  document_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  scanned_uploaded: "Auto-uploaded from scan",
  extracted: "Extracted",
  reextracted: "Re-extracted",
  edited: "Edited",
  approved: "Approved",
  exported: "Exported",
  deleted: "Moved to Trash",
  restored: "Restored from Trash",
  permanently_deleted: "Permanently deleted",
  failed: "Failed",
};

export function AuditLogsPage() {
  const { idToken } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listAuditLogs(idToken)
      .then((data) => setLogs(data as AuditLogEntry[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load audit logs."))
      .finally(() => setLoading(false));
  }, [idToken]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-navy">Audit logs</h1>
      <p className="mt-1 text-sm text-slate-soft">Every action taken on every document, in order.</p>

      {loading && <Loader2 className="mt-8 size-5 animate-spin text-slate-soft" />}
      {error && <p className="mt-4 text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
          {logs.map((log, i) => (
            <div key={log.id} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/5" : ""}`}>
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-sakura-blush)]/30 text-[color:var(--color-sakura-rose-deep)]">
                <ScrollText className="size-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-navy">
                  <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
                  {log.details?.overall_confidence != null && (
                    <span className="text-slate-soft"> · {String(log.details.overall_confidence)}% confidence</span>
                  )}
                  {log.details?.doc_type != null && <span className="text-slate-soft"> · {String(log.details.doc_type)}</span>}
                </p>
                <p className="text-xs text-slate-soft">
                  Document {log.document_id} · {new Date(log.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-soft">No activity yet.</p>}
        </div>
      )}
    </div>
  );
}
