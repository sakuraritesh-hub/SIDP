import clsx from "clsx";
import type { DocStatus } from "@/lib/sidp/schema";
import { Loader2, CircleCheck, CircleAlert, Eye, UploadCloud, PackageCheck } from "lucide-react";

const STATUS_CONFIG: Record<DocStatus, { label: string; icon: typeof Loader2; className: string }> = {
  uploaded: { label: "Uploaded", icon: UploadCloud, className: "text-slate-soft bg-black/5" },
  processing: {
    label: "Processing",
    icon: Loader2,
    className: "text-[color:var(--color-sakura-rose-deep)] bg-[color:var(--color-sakura-blush)]/40",
  },
  review: { label: "Needs Review", icon: Eye, className: "text-[color:var(--color-conf-warn)] bg-amber-50" },
  approved: { label: "Approved", icon: CircleCheck, className: "text-[color:var(--color-conf-good)] bg-emerald-50" },
  exported: { label: "Exported", icon: PackageCheck, className: "text-[color:var(--color-sakura-rose-deep)] bg-[color:var(--color-sakura-blush)]/30" },
  failed: { label: "Failed", icon: CircleAlert, className: "text-[color:var(--color-conf-bad)] bg-red-50" },
};

export function StatusPill({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cfg.className)}>
      <Icon className={clsx("size-3.5", status === "processing" && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
