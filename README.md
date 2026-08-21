# SIDP Frontend

React + Vite + TypeScript frontend for Sakura Intelligent Document Processing.
Talks to a Google Apps Script Web App backend (Sheets DB, Drive storage, Gemini vision extraction) — see `src/lib/api/client.ts`.

## Run locally

```
npm install
cp .env.example .env   # fill in your Apps Script Web App URL + Google OAuth client ID
npm run dev
```

Google sign-in needs the dev origin (e.g. `http://localhost:5173`) added as an
"Authorized JavaScript origin" on the OAuth client in Google Cloud Console,
or the button will silently fail to issue a token.

## What's here

- `src/lib/sidp/schema.ts` — the universal document schema shared with the backend (header / items / totals / confidence)
- `src/lib/sidp/sample-data.ts` — no longer wired into the UI; kept as a fixture for local dev/testing without a live backend
- `src/lib/api/client.ts` — API client; every call sends the signed-in user's Google ID token, verified server-side in Auth.gs
- `src/lib/auth/` — Google Identity Services sign-in (`AuthContext.tsx`), JWT decode for display claims only (`jwt.ts` — the backend independently verifies the signature)
- `src/routes/` — Dashboard (stat cards, pipeline state, document mix, captured value), Document Queue (admin sees every user's documents with an "Uploaded By" column + filter; regular users see only their own), Upload Center, Document Review (real Drive file preview with Source/Mapping/OCR-notes tabs, editable doc type + header fields + item rates for admins with a Save button, Re-extract, inline per-document export, rate-changes summary panel with up/down/new counts, Approve, move-to-Trash), Export Center (7 formats — see `src/lib/sidp/exporters.ts`), Vendor Learning, Rate Tracking (party-grouped changes, history, and a Summary tab — monthly trend, biggest movers, supplier volatility, XLSX export), Item Master (de-duplicated item catalog across suppliers, cheapest-supplier comparison), Audit Logs, Trash (restore or permanently delete), Settings
- `src/components/RequireAuth.tsx` — redirects to `/login` when there's no valid session
- `src/components/RequireAdmin.tsx` — redirects non-admins to `/upload`; wraps every admin-only route in `App.tsx`. Regular users get a minimal sidebar (Upload Center + Document Queue only, see `AppShell.tsx`'s `USER_NAV_ITEMS`) — this is a UX convenience, not the real security boundary, since the backend enforces the same restriction independently (see backend README's "Admin sees everyone's documents" section). Don't rely on hiding the nav item alone.
- `src/components/ConfidenceDot.tsx` — the confidence indicator used everywhere a field's trust score matters
- `src/index.css` — design tokens (navy/sakura palette, Space Grotesk + Inter + IBM Plex Mono type system)

## Still to wire up

- **Roles depend on a script property you have to set yourself.** `SIDP_ADMIN_EMAILS` (backend Script Properties) defaults to "everyone is admin" if unset — see the backend README before assuming rate-editing is actually restricted.
- **Validation updates on Save, not on every keystroke.** The review page's subtitle says "validation updates live" — that's true in the sense that Save re-validates server-side and refreshes the panel immediately, but it's not per-keystroke client-side validation (that would mean duplicating the whole Validation.gs engine in TypeScript, which isn't done). Type your corrections, then hit Save to see the validation panel and rate-changes table reflect them.
- **Re-extract discards edit history.** Re-running AI extraction on a document replaces the extracted data with a fresh read — any manual corrections made before the re-extract are gone, same as a first-time upload. There's no "diff against my edits" step.
- **Editing a flagged rate only corrects the `rate` field itself** — it does NOT recompute `taxable_amount`, tax amounts, or `line_total` from the new rate × quantity. If those need to change too, they're not automatically kept in sync yet.
- **Export Center's Tally XML and Generic ERP XML are best-effort starting templates, not validated integrations.** Tally XML uses standard ledger names ("Purchase Account", "CGST", etc.) and a specific credit/debit polarity that will very likely need adjusting to match your actual Tally ledger chart before a real import — test against a sandbox company first. Generic ERP XML is one fixed field mapping, not the configurable "field-mapping template" the label implies — there's no mapping editor UI.
- **REST API payload only downloads the JSON** — there's no target URL field or actual outbound POST anywhere. It's the payload you'd send, not something that gets sent.
- Inline field editing on the review page (the backend's `documents.edit` action is ready; the UI doesn't call it yet)
- Settings page is still static placeholder text — the confidence threshold and backend URL shown there aren't real, nothing is persisted or read from anywhere
- No auth restriction beyond "is a real Google account" — anyone who finds the URL and signs in gets a session; add an email allow-list/domain check in the backend's Auth.gs before treating this as production-secure
