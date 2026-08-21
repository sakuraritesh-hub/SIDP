import { useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Package, ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserBadge } from "@/components/UserBadge";

interface RateEntry {
  id: string;
  document_id: string;
  supplier_name: string;
  item_key: string;
  item_name: string;
  item_code: string | null;
  hsn_sac: string | null;
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

function masterKey(e: RateEntry) {
  return (e.item_code || e.item_name || "").trim().toLowerCase();
}

interface SupplierRate {
  supplier_name: string;
  rate: number;
  document_id: string;
  invoice_date: string | null;
  invoice_number: string | null;
}

interface MasterItem {
  key: string;
  itemName: string;
  itemCode: string | null;
  hsnSac: string | null;
  uom: string | null;
  suppliers: SupplierRate[]; // sorted cheapest first
  purchaseCount: number;
  lastPurchased: string | null;
}

export function ItemMasterPage() {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api
      .listRates(idToken, "")
      .then((data) => setEntries(data as RateEntry[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the item master."))
      .finally(() => setLoading(false));
  }, [idToken]);

  const items = useMemo<MasterItem[]>(() => {
    const byMasterKey = new Map<string, RateEntry[]>();
    entries.forEach((e) => {
      const key = masterKey(e);
      if (!key) return;
      const list = byMasterKey.get(key) || [];
      list.push(e);
      byMasterKey.set(key, list);
    });

    const result: MasterItem[] = [];
    byMasterKey.forEach((list, key) => {
      // Latest entry per supplier within this item.
      const bySupplier = new Map<string, RateEntry[]>();
      list.forEach((e) => {
        const l = bySupplier.get(e.supplier_name) || [];
        l.push(e);
        bySupplier.set(e.supplier_name, l);
      });

      const suppliers: SupplierRate[] = Array.from(bySupplier.entries())
        .map(([supplier_name, supplierEntries]) => {
          const latest = supplierEntries.slice().sort((a, b) => sortKey(b) - sortKey(a))[0];
          return {
            supplier_name,
            rate: latest.rate,
            document_id: latest.document_id,
            invoice_date: latest.invoice_date,
            invoice_number: latest.invoice_number,
          };
        })
        .sort((a, b) => a.rate - b.rate);

      const mostRecent = list.slice().sort((a, b) => sortKey(b) - sortKey(a))[0];
      const lastPurchased = list.reduce<string | null>((max, e) => {
        const d = e.invoice_date || e.created_at;
        return !max || new Date(d).getTime() > new Date(max).getTime() ? d : max;
      }, null);

      result.push({
        key,
        itemName: mostRecent.item_name,
        itemCode: mostRecent.item_code,
        hsnSac: mostRecent.hsn_sac,
        uom: mostRecent.uom,
        suppliers,
        purchaseCount: list.length,
        lastPurchased,
      });
    });

    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.itemName.toLowerCase().includes(q) ||
        i.itemCode?.toLowerCase().includes(q) ||
        i.suppliers.some((s) => s.supplier_name.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-navy">Item Master</h1>
          <p className="mt-1 text-sm text-slate-soft">
            Every item you've purchased, de-duplicated across suppliers — compare who's cheapest at a glance.
          </p>
        </div>
        <UserBadge />
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-black/10 bg-panel px-3 py-2.5">
        <Search className="size-4 text-slate-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item, code, or supplier..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-soft/70"
        />
      </div>

      {loading && <Loader2 className="size-5 animate-spin text-slate-soft" />}
      {error && <p className="text-sm text-[color:var(--color-conf-bad)]">{error}</p>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-soft">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">HSN/SAC</th>
                <th className="px-4 py-3 font-medium">UOM</th>
                <th className="px-4 py-3 font-medium">Suppliers</th>
                <th className="px-4 py-3 text-right font-medium">Best Rate</th>
                <th className="px-4 py-3 font-medium">Last Purchased</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isOpen = expanded.has(item.key);
                const best = item.suppliers[0];
                return (
                  <Fragment key={item.key}>
                    <tr
                      onClick={() => toggle(item.key)}
                      className="cursor-pointer border-b border-black/5 hover:bg-black/[0.02]"
                    >
                      <td className="px-4 py-3 text-slate-soft">
                        {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-navy">{item.itemName}</div>
                        {item.itemCode && <div className="text-xs text-slate-soft">{item.itemCode}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-soft">{item.hsnSac ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-soft">{item.uom ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-soft">
                        {item.suppliers.length} {item.suppliers.length === 1 ? "supplier" : "suppliers"}
                      </td>
                      <td className="px-4 py-3 text-right font-tabular">
                        <span className="font-medium text-ink-navy">{fmtRate(best.rate)}</span>
                        <div className="text-xs text-slate-soft">{best.supplier_name}</div>
                      </td>
                      <td className="px-4 py-3 font-tabular text-slate-soft">
                        {item.lastPurchased ? new Date(item.lastPurchased).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-tabular text-slate-soft">{item.purchaseCount}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-black/5 bg-black/[0.015]">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="ml-8 space-y-1.5">
                            {item.suppliers.map((s) => (
                              <div
                                key={s.supplier_name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/documents/${s.document_id}`);
                                }}
                                className={clsx(
                                  "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-black/[0.03]",
                                  s.rate === best.rate && "bg-emerald-50/60",
                                )}
                              >
                                <span className="text-ink-navy">{s.supplier_name}</span>
                                <span className="flex items-center gap-3 text-xs text-slate-soft">
                                  {s.invoice_number ?? "—"} · {s.invoice_date ?? "—"}
                                  <span className="font-tabular font-medium text-ink-navy">{fmtRate(s.rate)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-soft">
                    <Package className="mx-auto mb-2 size-6 text-slate-soft/60" />
                    {query ? `No items match "${query}".` : "No items on record yet — upload a purchase document first."}
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
