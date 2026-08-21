export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-navy">Settings</h1>
      <p className="mt-1 text-sm text-slate-soft">Review threshold, Apps Script backend URL, and account details.</p>

      <div className="mt-6 space-y-4 rounded-[var(--radius-card)] border border-black/10 bg-panel p-5">
        <div>
          <label className="text-xs font-medium text-slate-soft">Review confidence threshold</label>
          <p className="mt-1 text-sm text-slate-soft/80">
            Fields scoring below this are flagged for manual review. Currently 85%.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-soft">Backend Web App URL</label>
          <p className="mt-1 font-tabular text-sm text-slate-soft/80">Set via VITE_SIDP_API_URL</p>
        </div>
      </div>
    </div>
  );
}
