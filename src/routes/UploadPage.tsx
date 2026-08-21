import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, X, Loader2, CircleCheck, CircleAlert } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api/client";
import { fileToBase64 } from "@/lib/api/fileToBase64";
import { useAuth } from "@/lib/auth/AuthContext";
import type { SidpDocument } from "@/lib/sidp/schema";

type QueueStatus = "pending" | "uploading" | "done" | "error";

interface QueuedFile {
  file: File;
  id: string;
  status: QueueStatus;
  error?: string;
  documentId?: string;
}

export function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();
  const { idToken } = useAuth();

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter(
      (f) => /pdf|png|jpe?g|webp/i.test(f.type) || /\.(pdf|png|jpe?g|webp)$/i.test(f.name),
    );
    setQueue((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, id: `${file.name}-${file.size}-${Math.random()}`, status: "pending" as QueueStatus })),
    ]);
  }, []);

  const processQueue = async () => {
    setProcessing(true);
    let lastDocumentId: string | undefined;

    for (const item of queue) {
      if (item.status === "done") continue;
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "uploading" } : q)));
      try {
        const base64 = await fileToBase64(item.file);
        const doc = (await api.uploadDocument(idToken, {
          name: item.file.name,
          mimeType: item.file.type || "application/pdf",
          base64,
        })) as SidpDocument;
        lastDocumentId = doc.id;
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "done", documentId: doc.id } : q)));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Upload failed.";
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: message } : q)));
      }
    }

    setProcessing(false);
    if (lastDocumentId) {
      navigate(`/documents/${lastDocumentId}`);
    } else {
      navigate("/");
    }
  };

  const allDone = queue.length > 0 && queue.every((q) => q.status === "done" || q.status === "error");

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-navy">Upload documents</h1>
      <p className="mt-1 text-sm text-slate-soft">
        Invoices, POs, challans, LRs, e-way bills — any layout. SIDP reads them semantically, it doesn't need a
        template.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "mt-6 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-8 py-14 text-center transition-colors",
          dragActive
            ? "border-[color:var(--color-sakura-rose)] bg-[color:var(--color-sakura-blush)]/15"
            : "border-black/15 bg-panel",
        )}
      >
        <UploadCloud className="size-8 text-slate-soft" />
        <p className="text-sm text-slate-soft">
          Drag files here, or{" "}
          <label className="cursor-pointer font-medium text-[color:var(--color-sakura-rose-deep)] underline-offset-2 hover:underline">
            browse
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
              disabled={processing}
            />
          </label>
        </p>
        <p className="text-xs text-slate-soft/70">PDF, PNG, JPG, WEBP</p>
      </div>

      {queue.length > 0 && (
        <div className="mt-6 space-y-2">
          {queue.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-md border border-black/10 bg-panel px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-slate-soft" />
                <div>
                  <p className="text-sm font-medium text-ink-navy">{q.file.name}</p>
                  <p className="text-xs text-slate-soft">
                    {q.status === "error" ? q.error : `${(q.file.size / 1024).toFixed(0)} KB`}
                  </p>
                </div>
              </div>
              {q.status === "uploading" && <Loader2 className="size-4 animate-spin text-slate-soft" />}
              {q.status === "done" && <CircleCheck className="size-4 text-[color:var(--color-conf-good)]" />}
              {q.status === "error" && <CircleAlert className="size-4 text-[color:var(--color-conf-bad)]" />}
              {q.status === "pending" && (
                <button
                  onClick={() => setQueue((prev) => prev.filter((f) => f.id !== q.id))}
                  className="text-slate-soft hover:text-[color:var(--color-conf-bad)]"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={processQueue}
            disabled={processing || allDone}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--color-sakura-rose)] py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-sakura-rose-deep)] disabled:opacity-60"
          >
            {processing && <Loader2 className="size-4 animate-spin" />}
            {processing
              ? "Extracting…"
              : `Process ${queue.filter((q) => q.status === "pending").length || queue.length} document${queue.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
