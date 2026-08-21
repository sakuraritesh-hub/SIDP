// Thin client for the Apps Script Web App backend.
// The deployed Web App URL goes in VITE_SIDP_API_URL (.env).
// Every request carries the Google ID token; the backend verifies it
// and scopes all Sheets/Drive access to that user's email.

const API_URL = import.meta.env.VITE_SIDP_API_URL as string;

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  idToken: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Apps Script Web Apps route every call through an internal redirect
// (exec -> script.googleusercontent.com/macros/echo). Occasionally a
// deployment's redirect resolution gets into a bad state and this comes
// back as a 404 that never actually reached our doPost code — a transport
// failure, not an application error. 429/502/503/504 are the same idea:
// something between the browser and our script never completed the
// request. All of these are safe to retry, because if the request never
// reached the backend, nothing was created or changed there yet — no risk
// of e.g. a duplicate document from retrying an upload. Once we get back a
// real {ok:false} envelope, that means the backend DID run and made a
// decision — we stop and surface it instead of retrying blindly.
const RETRYABLE_HTTP_STATUSES = new Set([404, 429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

async function request<T>(action: string, { method = "POST", body, idToken }: RequestOptions): Promise<T> {
  if (!idToken) {
    throw new ApiError("Not signed in", "auth/no-token");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Apps Script Web Apps only reliably accept simple POST bodies (no
      // custom headers without a CORS preflight dance), so the token +
      // action travel inside the JSON payload rather than an Authorization
      // header.
      const res = await fetch(API_URL, {
        method,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, idToken, payload: body ?? {} }),
      });

      if (!res.ok) {
        if (RETRYABLE_HTTP_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(attempt * 1200);
          continue;
        }
        throw new ApiError(`Request failed (${res.status})`);
      }

      const json = await res.json();
      if (!json.ok) {
        throw new ApiError(json.error?.message ?? "Unknown error", json.error?.code);
      }
      return json.data as T;
    } catch (err) {
      // A thrown ApiError means the backend responded and we've already
      // decided not to retry — stop immediately.
      if (err instanceof ApiError) throw err;
      // Anything else here is a network-level failure (offline, DNS,
      // connection reset) — the request never reached the backend, so
      // it's safe to retry the same way as the HTTP-status cases above.
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 1200);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new ApiError("Request failed after retries");
}

export const api = {
  getMe: (idToken: string | null) =>
    request("auth.me", { idToken }) as Promise<{ email: string; full_name: string; role: "admin" | "user" }>,
  listDocuments: (idToken: string | null, params?: { status?: string; q?: string; deleted?: boolean }) =>
    request("documents.list", { idToken, body: params }),
  getDocument: (idToken: string | null, id: string) => request("documents.get", { idToken, body: { id } }),
  getDocumentFile: (idToken: string | null, id: string) =>
    request("documents.getFile", { idToken, body: { id } }) as Promise<{ base64: string; mimeType: string }>,
  uploadDocument: (idToken: string | null, file: { name: string; mimeType: string; base64: string }) =>
    request("documents.upload", { idToken, body: file }),
  reextractDocument: (idToken: string | null, id: string) => request("documents.reextract", { idToken, body: { id } }),
  persistEdits: (idToken: string | null, id: string, patch: Record<string, unknown>) =>
    request("documents.edit", { idToken, body: { id, patch } }),
  approveDocument: (idToken: string | null, id: string) => request("documents.approve", { idToken, body: { id } }),
  exportDocuments: (idToken: string | null, ids: string[]) => request("documents.export", { idToken, body: { ids } }),
  deleteDocument: (idToken: string | null, id: string) => request("documents.delete", { idToken, body: { id } }),
  restoreDocument: (idToken: string | null, id: string) => request("documents.restore", { idToken, body: { id } }),
  permanentlyDeleteDocument: (idToken: string | null, id: string) =>
    request("documents.permanentDelete", { idToken, body: { id } }),
  listVendors: (idToken: string | null) => request("vendors.list", { idToken }),
  listRates: (idToken: string | null, supplierName: string) =>
    request("rates.list", { idToken, body: { supplierName } }),
  listAuditLogs: (idToken: string | null, documentId?: string) =>
    request("auditlogs.list", { idToken, body: documentId ? { documentId } : {} }),
};
