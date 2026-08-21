// Decodes a JWT's payload without verifying its signature. Safe here only
// because it's used purely for UI display (name/email/picture) — every
// actual authorization decision happens server-side in Auth.gs, which
// verifies the token against Google's tokeninfo endpoint.
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}
