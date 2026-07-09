import { timingSafeEqual } from "node:crypto";
// Import the specific submodule rather than the `@app/core` barrel: this
// file is pulled into `middleware.ts`, which Next.js bundles for the Edge
// runtime. The barrel's `export *` chain reaches `db/client.ts` ->
// `@libsql/client`, a native module that Edge/webpack can't bundle. Going
// straight to `auth/token` (crypto-only, no db dependency) keeps that whole
// subtree out of the middleware bundle.
import { hashToken } from "@app/core/src/auth/token";

/**
 * Single-admin session auth. There is exactly one password (`ADMIN_PASSWORD`,
 * default `"admin"` for local/dev use) and exactly one session: the cookie's
 * value is the SHA-256 hex digest of that password. No per-user rows, no
 * expiry — this is a self-hosted single-operator admin panel.
 */

export const SESSION_COOKIE = "dap_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

let warnedDefaultPassword = false;

function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  if (!warnedDefaultPassword) {
    warnedDefaultPassword = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[dap] ADMIN_PASSWORD is not set; using the default password 'admin'. Set ADMIN_PASSWORD for anything beyond local development.",
    );
  }
  return "admin";
}

/** The expected `dap_session` cookie value for the current admin password. */
export function sessionValue(): string {
  return hashToken(adminPassword());
}

/** Whether the given plaintext password matches the configured admin password. */
export function checkPassword(password: string): boolean {
  return constantTimeEqual(password, adminPassword());
}

/** Whether a cookie value represents an authed session. */
export function isAuthed(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  return constantTimeEqual(cookieValue, sessionValue());
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseCookieHeader(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * Guard for route handlers: returns a 401 JSON `Response` when the request
 * isn't authed, or `null` when it's fine to proceed.
 */
export function requireAdmin(req: Request): Response | null {
  const cookieValue = parseCookieHeader(req.headers.get("cookie") ?? "", SESSION_COOKIE);
  if (isAuthed(cookieValue)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
