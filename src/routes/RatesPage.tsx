import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, TrendingUp, TrendingDown, Zap, AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserBadge } from "@/components/UserBadge";
import { RATE_ALERT_THRESHOLD_PERCENT } from "@/lib/sidp/schema";

interface RateEntry {
  id: string;
  document_id: string;
  supplier_name: string;
  item_key: string;
  item_name: string;
  item_code: string | null;
  uom: string | null;
  rate: number;
  invoice_number: string | null;
  invoice_date: string | null;
  created_at: string;
}

function sortKey(e: RateEntry) {
  return new Date(e.invoice_date || e.created_at).getTime();
}

function fmtRate(n: number) {
  return `₹${n.toFixed(2)}`;
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

function ChangeBadge({ previous, current }: { previous: number | null; current: number }) {
  if (previous == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sakura-blush)]/35 px-2.5 py-1 text-xs font-medium text-[color:var(--color-sakura-rose-deep)]">
        <Zap className="size-3" />
        First purchase
      </span>
    );
  }
  if (previous === current) {
    return <span className="text-xs text-slate-soft">No change</span>;
  }
  const up = current > previous;
  const pct = Math.abs(((current - previous) / previous) * 100);
  const alert = pct >= RATE_ALERT_THRESHOLD_PERCENT;
  return (
    <span
      title={alert ? `${pct.toFixed(1)}% is past your ${RATE_ALERT_THRESHOLD_PERCENT}% alert threshold` : undefined}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        alert
          ? up
            ? "bg-[color:var(--color-conf-bad)] text-white"
            : "bg-[color:var(--color-conf-good)] text-white"
          : up
            ? "bg-red-50 text-[color:var(--color-conf-bad)]"
            : "bg-emerald-50 text-[color:var(--color-conf-good)]",
      )}
    >
      {alert ? <AlertTriangle className="size-3" /> : up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {pct.toFixed(1)}%
    </span>
  );
}

export function RatesPage() {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"changes" | "history" | "summary">("changes");
  const [party, setParty] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .listRates(idToken, "")
      .then((data) => setEntries(data as RateEntry[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load rate history."))
      .finally(() => setLoading(false));
  }, [idToken]);

  // One chronologically-sorted history array per (supplier, item) pair —
  // everything else (stats, both tabs) derives from this.
  const historyByItemKey = useMemo(() => {
    const map = new Map<string, RateEntry[]>();
    entries.forEach((e) => {
      const list = map.get(e.item_key) || [];
      list.push(e);
      map.set(e.item_key, list);
    });
    map.forEach((list) => list.sort((a, b) => sortKey(a) - sortKey(b)));
    return map;
  }, [entries]);

  const previousFor = (entry: RateEntry): RateEntry | null => {
    const history = historyByItemKey.get(entry.item_key) || [];
    const idx = history.findIndex((e) => e.id === entry.id);
    return idx > 0 ? history[idx - 1] : null;
  };

  const parties = useMemo(() => Array.from(new Set(entries.map((e) => e.supplier_name))).sort(), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (party !== "all" && e.supplier_name !== party) return false;
      if (!q) return true;
      return e.item_name?.toLowerCase().includes(q) || e.supplier_name?.toLowerCase().includes(q);
    });
  }, [entries, party, query]);

  const stats = useMemo(() => {
    let increases = 0;
    let decreases = 0;
    let firstTime = 0;
    let alerts = 0;
    entries.forEach((e) => {
      const prev = previousFor(e);
      if (!prev) {
        firstTime++;
        return;
      }
      if (e.rate > prev.rate) increases++;
      else if (e.rate < prev.rate) decreases++;
      const pct = Math.abs(((e.rate - prev.rate) / prev.rate) * 100);
      if (pct >= RATE_ALERT_THRESHOLD_PERCENT) alerts++;
    });
    return {
      increases,
      decreases,
      firstTime,
      alerts,
      ratesOnRecord: historyByItemKey.size,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, historyByItemKey]);

  // "Rate changes" tab — grouped by the document each row came from.
  const documentGroups = useMemo(() => {
    const groups = new Map<
      string,
      { document_id: string; supplier_name: string; invoice_number: string | null; invoice_date: string | null; latest: number; items: RateEntry[] }
    >();
    filtered.forEach((e) => {
      const g = groups.get(e.document_id) || {
        document_id: e.document_id,
        supplier_name: e.supplier_name,
        invoice_number: e.invoice_number,
        invoice_date: e.invoice_date,
        latest: sortKey(e),
        items: [],
      };
      g.items.push(e);
      g.latest = Math.max(g.latest, sortKey(e));
      groups.set(e.document_id, g);
    });
    return Array.from(groups.values()).sort((a, b) => b.latest - a.latest);
  }, [filtered]);

  // "Rate history" tab — the most recent actual change per item, newest first.
  const recentChanges = useMemo(() => {
    const seen = new Set<string>();
    return filtered
      .slice()
      .sort((a, b) => sortKey(b) - sortKey(a))
      .filter((e) => {
        if (seen.has(e.item_key)) return false;
        seen.add(e.item_key);
        const prev = previousFor(e);
        return prev != null && prev.rate !== e.rate;
      })
      .map((e) => ({ current: e, previous: previousFor(e)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, historyByItemKey]);

  // "Summary" tab — every discrete change event in your history (not just
  // the latest per item), which is what a proper trend/volatility report
  // needs rather than a snapshot.
  interface ChangeEvent {
    item_name: string;
    supplier_name: string;
    previous_rate: number;
    new_rate: number;
    change_percent: number;
    invoice_date: string | null;
    invoice_number: string | null;
  }

  const allChanges = useMemo<ChangeEvent[]>(() => {
    const changes: ChangeEvent[] = [];
    filtered.forEach((e) => {
      const prev = previousFor(e);
      if (prev && prev.rate !== e.rate) {
        changes.push({
          item_name: e.item_name,
          supplier_name: e.supplier_name,
          previous_rate: prev.rate,
          new_rate: e.rate,
          change_percent: ((e.rate - prev.rate) / prev.rate) * 100,
          invoice_date: e.invoice_date,
          invoice_number: e.invoice_number,
        });
      }
    });
    return changes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, historyByItemKey]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, { increases: number; decreases: number }>();
    allChanges.forEach((c) => {
      const d = new Date(c.invoice_date || "");
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byMonth.get(key) || { increases: 0, decreases: 0 };
      if (c.change_percent > 0) bucket.increases++;
      else bucket.decreases++;
      byMonth.set(key, bucket);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // last 6 months with activity
      .map(([month, counts]) => ({
        label: new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        ...counts,
      }));
  }, [allChanges]);

  const topMovers = useMemo(() => allChanges.slice().sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent)).slice(0, 8), [allChanges]);

  const supplierVolatility = useMemo(() => {
    const byParty = new Map<string, { count: number; totalAbsPct: number; increases: number; decreases: number }>();
    allChanges.forEach((c) => {
      const v = byParty.get(c.supplier_name) || { count: 0, totalAbsPct: 0, increases: 0, decreases: 0 };
      v.count++;
      v.totalAbsPct += Math.abs(c.change_percent);
      if (c.change_percent > 0) v.increases++;
      else v.decreases++;
      byParty.set(c.supplier_name, v);
    });
    return Array.from(byParty.entries())
      .map(([supplier_name, v]) => ({ supplier_name, ...v, avgAbsPct: v.totalAbsPct / v.count }))
      .sort((a, b) => b.count - a.count);
  }, [allChanges]);

  const exportSummary = () => {
    const changeRows = allChanges.map((c) => ({
      Supplier: c.supplier_name,
      Item: c.item_name,
      "Previous Rate": c.previous_rate,
      "New Rate": c.new_rate,
      "Change %": Number(c.change_percent.toFixed(1)),
      "Invoice No.": c.invoice_number,
      "Invoice Date": c.invoice_date,
    }));
    const supplierRows = supplierVolatility.map((s) => ({
      Supplier: s.supplier_name,
      "Total Changes": s.count,
      Increases: s.increases,
      Decreases: s.decreases,
      "Avg Change % (abs)": Number(s.avgAbsPct.toFixed(1)),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(changeRows), "All Changes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), "Supplier Summary");
    XLSX.writeFile(wb, `SIDP-rate-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-navy">Party rate tracking</h1>
          <p className="mt-1 text-sm text-slate-soft">Every scanned purchase is compared against that party's last recorded rates</p>
        </div>
        <UserBadge />
      </header>

      {loading && <Loader2 className="size-5 animate-spin text-slate-soft" />}
      {error && <p className="text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Rate Increases" value={stats.increases} caption="Across recent scans" />
            <StatCard label="Rate Decreases" value={stats.decreases} caption="Across recent scans" />
            <StatCard label="Alerts" value={stats.alerts} caption={`≥${RATE_ALERT_THRESHOLD_PERCENT}% change — also emailed`} />
            <StatCard label="First-time Items" value={stats.firstTime} caption="No prior rate on record" />
            <StatCard label="Rates on Record" value={stats.ratesOnRecord} caption="Party-wise rate history" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <select
              value={party}
              onChange={(e) => setParty(e.target.value)}
              className="rounded-md border border-black/10 bg-panel px-3 py-2.5 text-sm text-ink-navy outline-none"
            >
              <option value="all">All parties</option>
              {parties.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="flex flex-1 items-center gap-2 rounded-md border border-black/10 bg-panel px-3 py-2.5">
              <Search className="size-4 text-slate-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item or party..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-soft/70"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="inline-flex rounded-md border border-black/10 bg-panel p-1">
              {(["changes", "history", "summary"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t ? "bg-black/5 text-ink-navy" : "text-slate-soft hover:text-ink-navy",
                  )}
                >
                  {t === "changes" ? "Rate changes" : t === "history" ? "Rate history" : "Summary"}
                </button>
              ))}
            </div>
            {tab === "summary" && allChanges.length > 0 && (
              <button
                onClick={exportSummary}
                className="flex items-center gap-1.5 rounded-md border border-black/10 bg-panel px-3 py-1.5 text-xs font-medium text-slate-soft hover:border-black/20 hover:text-ink-navy"
              >
                <Download className="size-3.5" />
                Export
              </button>
            )}
          </div>

          {tab === "changes" && (
            <div className="mt-4 space-y-4">
              {documentGroups.map((g) => (
                <div key={g.document_id} className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
                  <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
                    <p className="text-sm font-semibold text-ink-navy">
                      {g.supplier_name}{" "}
                      <span className="font-tabular font-normal text-slate-soft">
                        {g.invoice_number ?? "—"} · {g.invoice_date ?? "—"}
                      </span>
                    </p>
                    <button
                      onClick={() => navigate(`/documents/${g.document_id}`)}
                      className="text-xs font-medium text-[color:var(--color-sakura-rose-deep)] hover:underline"
                    >
                      Open document
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
                        <th className="px-5 py-2.5 font-medium">Item</th>
                        <th className="px-5 py-2.5 font-medium">UOM</th>
                        <th className="px-5 py-2.5 text-right font-medium">Previous Rate</th>
                        <th className="px-5 py-2.5 text-right font-medium">Current Rate</th>
                        <th className="px-5 py-2.5 font-medium">Change</th>
                        <th className="px-5 py-2.5 font-medium">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((item) => {
                        const prev = previousFor(item);
                        return (
                          <tr key={item.id} className="border-b border-black/5 last:border-0">
                            <td className="px-5 py-3 font-medium text-ink-navy">{item.item_name}</td>
                            <td className="px-5 py-3 text-slate-soft">{item.uom ?? "—"}</td>
                            <td className="px-5 py-3 text-right font-tabular text-slate-soft">
                              {prev ? fmtRate(prev.rate) : "—"}
                            </td>
                            <td className="px-5 py-3 text-right font-tabular font-medium text-ink-navy">{fmtRate(item.rate)}</td>
                            <td className="px-5 py-3">
                              <ChangeBadge previous={prev?.rate ?? null} current={item.rate} />
                            </td>
                            <td className="px-5 py-3 font-tabular text-slate-soft">{prev?.invoice_date ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              {documentGroups.length === 0 && <p className="py-10 text-center text-sm text-slate-soft">No scanned purchases yet.</p>}
            </div>
          )}

          {tab === "history" && (
            <div className="mt-4 space-y-2">
              {recentChanges.map(({ current, previous }) => {
                const up = current.rate > previous.rate;
                const pct = Math.abs(((current.rate - previous.rate) / previous.rate) * 100).toFixed(1);
                return (
                  <div
                    key={current.item_key}
                    className="flex items-center justify-between rounded-[var(--radius-card)] border border-black/10 bg-panel px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-navy">{current.item_name}</p>
                      <p className="text-xs text-slate-soft">
                        {current.supplier_name} · saw on {current.invoice_number ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-tabular text-sm">
                      <span className="text-slate-soft">{fmtRate(previous.rate)}</span>
                      <span className="text-slate-soft">→</span>
                      <span className="font-medium text-ink-navy">{fmtRate(current.rate)}</span>
                      <span
                        className={clsx(
                          "flex items-center gap-0.5",
                          up ? "text-[color:var(--color-conf-bad)]" : "text-[color:var(--color-conf-good)]",
                        )}
                      >
                        {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {recentChanges.length === 0 && <p className="py-10 text-center text-sm text-slate-soft">No rate changes detected yet.</p>}
            </div>
          )}

          {tab === "summary" && (
            <div className="mt-4 space-y-4">
              <div className="rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
                <h2 className="mb-4 font-display text-sm font-semibold text-ink-navy">Monthly trend</h2>
                {monthlyTrend.length === 0 ? (
                  <p className="text-sm text-slate-soft">Not enough dated history yet to show a trend.</p>
                ) : (
                  <div className="flex items-end gap-4" style={{ height: 140 }}>
                    {monthlyTrend.map((m) => {
                      const max = Math.max(...monthlyTrend.map((x) => x.increases + x.decreases), 1);
                      const total = m.increases + m.decreases;
                      const incH = total ? (m.increases / max) * 110 : 0;
                      const decH = total ? (m.decreases / max) * 110 : 0;
                      return (
                        <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                          <div className="flex items-end gap-1" style={{ height: 110 }}>
                            <div
                              className="w-4 rounded-t bg-[color:var(--color-conf-bad)]"
                              style={{ height: incH }}
                              title={`${m.increases} increase${m.increases === 1 ? "" : "s"}`}
                            />
                            <div
                              className="w-4 rounded-t bg-[color:var(--color-conf-good)]"
                              style={{ height: decH }}
                              title={`${m.decreases} decrease${m.decreases === 1 ? "" : "s"}`}
                            />
                          </div>
                          <span className="text-[11px] text-slate-soft">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-soft">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[color:var(--color-conf-bad)]" /> Increases
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[color:var(--color-conf-good)]" /> Decreases
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
                  <div className="border-b border-black/10 px-5 py-3.5">
                    <h2 className="font-display text-sm font-semibold text-ink-navy">Biggest movers</h2>
                  </div>
                  <div>
                    {topMovers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-black/5 px-5 py-2.5 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-ink-navy">{c.item_name}</p>
                          <p className="text-xs text-slate-soft">{c.supplier_name}</p>
                        </div>
                        <ChangeBadge previous={c.previous_rate} current={c.new_rate} />
                      </div>
                    ))}
                    {topMovers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-soft">No changes on record.</p>}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
                  <div className="border-b border-black/10 px-5 py-3.5">
                    <h2 className="font-display text-sm font-semibold text-ink-navy">Supplier volatility</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
                        <th className="px-5 py-2 font-medium">Supplier</th>
                        <th className="px-5 py-2 text-right font-medium">Changes</th>
                        <th className="px-5 py-2 text-right font-medium">Avg %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierVolatility.map((s) => (
                        <tr key={s.supplier_name} className="border-b border-black/5 last:border-0">
                          <td className="px-5 py-2.5 text-ink-navy">{s.supplier_name}</td>
                          <td className="px-5 py-2.5 text-right font-tabular text-slate-soft">
                            {s.count} <span className="text-[11px]">({s.increases}↑ {s.decreases}↓)</span>
                          </td>
                          <td className="px-5 py-2.5 text-right font-tabular text-slate-soft">{s.avgAbsPct.toFixed(1)}%</td>
                        </tr>
                      ))}
                      {supplierVolatility.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-soft">
                            No changes on record.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
