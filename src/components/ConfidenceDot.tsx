import { confidenceTier } from "@/lib/sidp/schema";
import clsx from "clsx";

const TIER_STYLES = {
  good: "bg-[color:var(--color-conf-good)]",
  warn: "bg-[color:var(--color-conf-warn)]",
  bad: "bg-[color:var(--color-conf-bad)]",
};

const TIER_RING = {
  good: "ring-[color:var(--color-conf-good)]/25",
  warn: "ring-[color:var(--color-conf-warn)]/25",
  bad: "ring-[color:var(--color-conf-bad)]/30",
};

export function ConfidenceDot({
  score,
  size = "sm",
  pulse = false,
}: {
  score: number | null | undefined;
  size?: "sm" | "md";
  pulse?: boolean;
}) {
  const tier = confidenceTier(score);
  const dimension = size === "sm" ? "size-2" : "size-2.5";

  return (
    <span
      className="group relative inline-flex items-center"
      title={score != null ? `${Math.round(score)}% confidence` : "No confidence data"}
    >
      <span
        className={clsx(
          "rounded-full ring-4",
          dimension,
          TIER_STYLES[tier],
          TIER_RING[tier],
          pulse && "animate-pulse",
        )}
      />
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  const tier = confidenceTier(score);
  const label = score != null ? `${Math.round(score)}%` : "—";
  const textColor = {
    good: "text-[color:var(--color-conf-good)]",
    warn: "text-[color:var(--color-conf-warn)]",
    bad: "text-[color:var(--color-conf-bad)]",
  }[tier];

  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-tabular text-xs font-medium", textColor)}>
      <ConfidenceDot score={score} />
      {label}
    </span>
  );
}
