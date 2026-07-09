import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * `SESSION_SECRET`/`ADMIN_PASSWORD` are read once, at module load (so the
 * warn-on-missing-secret behavior in `auth.ts` fires exactly once per
 * process). To exercise different env configurations we reset the module
 * registry and re-import between tests.
 */
async function freshAuth(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("./auth");
}

const ORIGINAL_ENV = { ...process.env };

describe("session tokens", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("createSession -> verifySession round-trips true", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret", ADMIN_PASSWORD: "test" });
    const token = auth.createSession();
    expect(typeof token).toBe("string");
    expect(token).toContain(".");
    expect(auth.verifySession(token)).toBe(true);
    expect(auth.isAuthed(token)).toBe(true);
  });

  test("verifySession rejects undefined/null/empty", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    expect(auth.verifySession(undefined)).toBe(false);
    expect(auth.verifySession(null)).toBe(false);
    expect(auth.verifySession("")).toBe(false);
  });

  test("verifySession rejects a tampered payload (signature no longer matches)", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    const token = auth.createSession();
    const [payloadB64, sig] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 999_999_999 }), "utf8").toString(
      "base64url",
    );
    const tampered = `${tamperedPayload}.${sig}`;
    expect(tampered).not.toBe(token);
    expect(auth.verifySession(tampered)).toBe(false);
    void payloadB64;
  });

  test("verifySession rejects a token signed with a different secret", async () => {
    const authA = await freshAuth({ SESSION_SECRET: "secret-a" });
    const token = authA.createSession();

    const authB = await freshAuth({ SESSION_SECRET: "secret-b" });
    expect(authB.verifySession(token)).toBe(false);
  });

  test("verifySession rejects malformed tokens", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    expect(auth.verifySession("not-a-valid-token")).toBe(false);
    expect(auth.verifySession("..")).toBe(false);
    expect(auth.verifySession("Zm9v.")).toBe(false);
  });

  test("verifySession rejects an expired session", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow);
    const token = auth.createSession();
    expect(auth.verifySession(token)).toBe(true);

    // Advance past the 7-day TTL.
    nowSpy.mockReturnValue(realNow + auth.SESSION_TTL_MS + 1000);
    expect(auth.verifySession(token)).toBe(false);
    nowSpy.mockRestore();
  });

  test("without SESSION_SECRET set, a random secret is generated once and a warning is logged", async () => {
    delete (globalThis as Record<string, unknown>).__dap_session_secret__;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = await freshAuth({ SESSION_SECRET: undefined, ADMIN_PASSWORD: "test" });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SESSION_SECRET is not set"));
    expect(auth.SESSION_SECRET_GLOBAL_KEY).toBe("__dap_session_secret__");

    const token = auth.createSession();
    expect(auth.verifySession(token)).toBe(true);

    // A *re-instantiation* of the module within the same process (e.g. a
    // separate Next.js bundle for middleware vs. route handlers, both
    // importing this file) must reuse the same generated secret — that's
    // the whole reason it's cached on `globalThis` rather than a plain
    // module-scope variable. Simulate that here via `vi.resetModules()` +
    // re-import, without clearing the global cache.
    warnSpy.mockClear();
    const auth2 = await freshAuth({ SESSION_SECRET: undefined, ADMIN_PASSWORD: "test" });
    expect(auth2.verifySession(token)).toBe(true);
    // No secret was generated the second time, so no warning fires again.
    expect(warnSpy).not.toHaveBeenCalled();

    // A *genuine* process restart clears that global cache; the next
    // process to come up mints a fresh, unrelated secret, so old sessions
    // stop verifying — this is the documented "doesn't survive a restart"
    // trade-off, and confirms the secret isn't derived from something
    // static like the password.
    delete (globalThis as Record<string, unknown>).__dap_session_secret__;
    const auth3 = await freshAuth({ SESSION_SECRET: undefined, ADMIN_PASSWORD: "test" });
    expect(auth3.verifySession(token)).toBe(false);

    warnSpy.mockRestore();
    delete (globalThis as Record<string, unknown>).__dap_session_secret__;
  });
});

describe("checkPassword", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("accepts the configured ADMIN_PASSWORD", async () => {
    const auth = await freshAuth({ ADMIN_PASSWORD: "correct-horse", SESSION_SECRET: "test-secret" });
    expect(auth.checkPassword("correct-horse")).toBe(true);
  });

  test("rejects a wrong password", async () => {
    const auth = await freshAuth({ ADMIN_PASSWORD: "correct-horse", SESSION_SECRET: "test-secret" });
    expect(auth.checkPassword("wrong")).toBe(false);
  });

  test("rejects passwords of different lengths without throwing (constant-time hash compare)", async () => {
    const auth = await freshAuth({ ADMIN_PASSWORD: "correct-horse", SESSION_SECRET: "test-secret" });
    expect(auth.checkPassword("x")).toBe(false);
    expect(auth.checkPassword("a-very-much-longer-than-expected-guess")).toBe(false);
  });

  test("falls back to the default 'admin' password when ADMIN_PASSWORD is unset", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = await freshAuth({ ADMIN_PASSWORD: undefined, SESSION_SECRET: "test-secret" });
    expect(auth.checkPassword("admin")).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ADMIN_PASSWORD is not set"));
    warnSpy.mockRestore();
  });
});

describe("requireAdmin", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("returns null (proceeds) for a request with a valid session cookie", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    const token = auth.createSession();
    const req = new Request("http://localhost/api/_manage/apis", {
      headers: { cookie: `${auth.SESSION_COOKIE}=${token}` },
    });
    expect(auth.requireAdmin(req)).toBeNull();
  });

  test("returns a 401 Response when the cookie is missing", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    const req = new Request("http://localhost/api/_manage/apis");
    const res = auth.requireAdmin(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  test("returns a 401 Response when the cookie is tampered", async () => {
    const auth = await freshAuth({ SESSION_SECRET: "test-secret" });
    const token = auth.createSession();
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const req = new Request("http://localhost/api/_manage/apis", {
      headers: { cookie: `${auth.SESSION_COOKIE}=${tampered}` },
    });
    const res = auth.requireAdmin(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });
});

describe("SESSION_COOKIE_OPTIONS", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("secure is false outside production", async () => {
    const auth = await freshAuth({ NODE_ENV: "development", SESSION_SECRET: "test-secret" });
    expect(auth.SESSION_COOKIE_OPTIONS.secure).toBe(false);
    expect(auth.SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(auth.SESSION_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(auth.SESSION_COOKIE_OPTIONS.path).toBe("/");
  });

  test("secure is true in production", async () => {
    const auth = await freshAuth({ NODE_ENV: "production", SESSION_SECRET: "test-secret" });
    expect(auth.SESSION_COOKIE_OPTIONS.secure).toBe(true);
  });
});
