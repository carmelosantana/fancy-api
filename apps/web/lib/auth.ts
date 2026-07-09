import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
// Import the specific submodule rather than the `@app/core` barrel: this
// file is pulled into `middleware.ts`, which Next.js bundles for the Edge
// runtime. The barrel's `export *` chain reaches `db/client.ts` ->
// `@libsql/client`, a native module that Edge/webpack can't bundle. Going
// straight to `auth/token` (crypto-only, no db dependency) keeps that whole
// subtree out of the middleware bundle.
import { hashToken } from "@app/core/src/auth/token";

/**
 * Single-admin session auth. There is exactly one password (`ADMIN_PASSWORD`,
 * default `"admin"` for local/dev use). A session is a signed, expiring
 * token: `base64url(payload) + "." + HMAC-SHA256(base64url(payload), secret)`,
 * where `payload` carries an expiry timestamp. This means the cookie is not
 * offline-forgeable from a guessed password (unlike a bare hash of the
 * password) and does not live forever once captured.
 */

export const SESSION_COOKIE = "dap_session";

/** How long a session is valid for after being created. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
  // Plain http://localhost is how this app is normally run/demoed in dev,
  // so only require Secure once we're actually in production.
  secure: process.env.NODE_ENV === "production",
};

/**
 * Global cache key for the generated fallback secret (see below). Exported
 * so tests can simulate a fresh process by clearing it.
 */
export const SESSION_SECRET_GLOBAL_KEY = "__dap_session_secret__";
type GlobalWithSecret = typeof globalThis & { [SESSION_SECRET_GLOBAL_KEY]?: string };
const globalForSecret = globalThis as GlobalWithSecret;

/**
 * The HMAC key used to sign session tokens. Deliberately independent of
 * `ADMIN_PASSWORD` — deriving it from the password would make the session
 * scheme only as strong as password-guessing again. If `SESSION_SECRET`
 * isn't configured, a random one is generated once at module load and
 * cached on `globalThis` (rather than a plain module-scope variable):
 * Next.js compiles `middleware.ts` and the various route handlers as
 * *separate* bundles, each getting its own instance of this module, and
 * they all need to agree on one secret within a process for a session
 * minted by the login route to verify in middleware. `globalThis` is the
 * one thing every one of those bundle instances actually shares. Net
 * effect: sessions remain unforgeable, but none of them survive a real
 * process restart (every restart invalidates all existing sessions) — a
 * reasonable trade-off for local/dev use; production deployments should
 * set `SESSION_SECRET`.
 */
const SESSION_SECRET: string = (() => {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;

  const cached = globalForSecret[SESSION_SECRET_GLOBAL_KEY];
  if (cached) return cached;

  const generated = randomBytes(32).toString("hex");
  globalForSecret[SESSION_SECRET_GLOBAL_KEY] = generated;
  // eslint-disable-next-line no-console
  console.warn(
    "[dap] SESSION_SECRET is not set; generated a random secret for this process only. " +
      "Sessions will NOT survive a restart (every restart invalidates all logins). " +
      "Set SESSION_SECRET for anything beyond local development.",
  );
  return generated;
})();

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

function sign(payloadB64: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
}

/** Mints a new signed session token, valid for `SESSION_TTL_MS` from now. */
export function createSession(): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verifies a `dap_session` cookie value: the HMAC signature must match
 * (constant-time) AND the embedded expiry must not have passed.
 */
export function verifySession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return false;

  const payloadB64 = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = sign(payloadB64);

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const exp = (payload as { exp?: unknown })?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  return Date.now() < exp;
}

/**
 * Whether the given plaintext password matches the configured admin
 * password. Both sides are hashed to a fixed-width digest before comparing,
 * so — unlike comparing the raw strings — the byte length of the submitted
 * password is never observable via early-exit timing.
 */
export function checkPassword(password: string): boolean {
  const supplied = Buffer.from(hashToken(password), "hex");
  const expected = Buffer.from(hashToken(adminPassword()), "hex");
  // SHA-256 hex digests are always 32 bytes; this length check can never
  // actually fail, it's just what makes `timingSafeEqual`'s contract explicit.
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}

/** Whether a cookie value represents an authed session. */
export function isAuthed(cookieValue: string | undefined | null): boolean {
  return verifySession(cookieValue);
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
