# Fancy — Final Whole-Branch Security & Correctness Review

Date: 2026-07-09 · Branch: `master` · Reviewer: final whole-branch pass

Scope: `packages/core/src` (query/build, params, mcp/tools, auth/token, repo, spec, db)
and `apps/web` (middleware, lib/auth, lib/publicApi, all `app/api/*` routes).

Summary of counts: **1 Critical, 3 Important, 5 Minor.**
Several categories are clean — see "Clean categories" at the end.

---

## CRITICAL

### C1. Admin session token is offline-forgeable + a well-known default password ships in `docker-compose.yml`
- **Where:** `apps/web/lib/auth.ts:41-43` (`sessionValue = hashToken(adminPassword())`),
  `apps/web/lib/auth.ts:27-38` (default password fallback), `docker-compose.yml`
  (`ADMIN_PASSWORD: ${ADMIN_PASSWORD:-change-me}`), `.env.example` (`ADMIN_PASSWORD=change-me`).
- **Attack:** The `dap_session` cookie value is exactly the unsalted SHA-256 hex of the
  admin password — there is **no server-side secret / HMAC key** in the derivation. Anyone
  can compute a valid session cookie *offline* from a guessed password and set it directly;
  no `/login` round-trip and no rate limit are involved. The shipped compose default is
  `change-me`, so against any instance the operator did not reconfigure, an attacker sets
  `Cookie: dap_session=<sha256("change-me")>` and obtains **full management/admin access**
  (create/delete APIs, rotate/read write-tokens, import/export) with zero knowledge. The
  `auth.ts` default of `"admin"` (when the env var is entirely unset) is the same class of
  problem, and only a `console.warn` guards it — the server still boots and serves.
- **Also:** the cookie value never rotates and never expires, so any one-time capture is a
  permanent credential.
- **Fix:** Introduce a server-side secret (`SESSION_SECRET`, random-generated & persisted if
  unset) and make the session an HMAC/signed token (e.g. `HMAC(secret, "admin")` or a random
  session id stored server-side), not a bare hash of the password — this removes offline
  forgeability and default-password precomputation. Refuse to boot in production
  (`NODE_ENV=production`) when `ADMIN_PASSWORD` is unset or equals a known default. Add an
  expiry/rotation. Ship no working default credential.

---

## IMPORTANT

### I1. `openapi.json` public route does not enforce the read key
- **Where:** `apps/web/app/api/[api]/openapi.json/route.ts:38-46` — resolves the API and
  returns the full OpenAPI document with **no `checkReadKey` call** (contrast the sibling
  list/id/random routes, which all gate).
- **Attack:** For an API that set a `readKey` (i.e. intended to be private), anyone can
  `GET /api/<slug>/openapi.json` without the key and enumerate every collection slug, field
  name, type, and filter surface. It leaks structure, not row data, but it is a read route
  that bypasses the gate the task explicitly requires on *all* public reads.
- **Fix:** Call `checkReadKey(req, api)` (and `logRequest(...401)`) immediately after
  `resolveApi`, mirroring the other three public routes.

### I2. `exportApi` leaks the read key via `config`
- **Where:** `packages/core/src/spec/export.ts:35` returns `config: api.config` verbatim;
  the read gate accepts a key stored at `config.readKey` (`apps/web/lib/publicApi.ts:31-35`).
- **Attack:** `export.ts` claims to be "secret-free" and `import.ts` claims specs "never carry
  readKey/writeToken", but when a read key is configured through `config.readKey` (the only
  path the gate actually honors, since the dedicated `read_key` column is never populated by
  any create/import flow), the exported YAML/JSON spec embeds it. Since export exists to
  produce a *portable, shareable* spec, sharing it discloses the read gate secret and defeats
  the private-API protection.
- **Fix:** Strip known secret keys (`readKey`, and any future token fields) from `config`
  before returning in `exportApi`, or move `readKey` out of `config` entirely into the
  dedicated column and never export that column.

### I3. Session cookie missing `Secure` (and no CSRF-independent transport protection)
- **Where:** `apps/web/lib/auth.ts:19-23` — `SESSION_COOKIE_OPTIONS` sets `httpOnly` and
  `sameSite: "lax"` but **not `secure`**.
- **Attack:** Over plain HTTP (or a downgrade), the long-lived, non-expiring session cookie is
  transmitted in cleartext and can be sniffed and replayed indefinitely (compounds C1's
  no-expiry property). `sameSite=lax` mitigates CSRF but does nothing for transport exposure.
- **Fix:** Set `secure: true` (gated on `NODE_ENV==="production"` so local http dev still
  works), and pair with the expiry from C1.

---

## MINOR

### M1. `checkPassword` leaks password length via early length-mismatch return
- `apps/web/lib/auth.ts:56-61`: `constantTimeEqual` returns `false` before `timingSafeEqual`
  when lengths differ, leaking the password's byte length through timing. Low value to an
  attacker; hash the input to a fixed width before comparing to close it.

### M2. No brute-force / rate limiting on `/api/_manage/login`
- `apps/web/app/api/%5Fmanage/login/route.ts`: unlimited password attempts, no lockout or
  backoff. Largely moot given C1 (offline forgery is easier), but still worth a simple
  attempt limiter once C1 is fixed.

### M3. Reserved collection slug (`openapi.json`) not enforced on import
- `apps/web/app/api/%5Fmanage/import/route.ts:28` checks only `RESERVED_API_SLUGS`. An
  imported spec may define a collection slug `openapi.json` (or `random`), which then becomes
  unreachable because the static route wins. No data exposure — just a silently dead
  collection. Validate collection slugs against `RESERVED_COLLECTION_SLUGS` on import too.

### M4. `apiSlug` not format-validated on create
- `apps/web/app/api/%5Fmanage/apis/route.ts:87-93` accepts any trimmed non-reserved string as
  a slug (no `slugify`/charset check), so an admin can create an API whose slug contains
  characters that don't round-trip cleanly in a URL path. Admin-only, so low risk; run the
  slug through `slugify`/a `^[a-z0-9-]+$` validation for robustness.

### M5. MCP read tools have no server-side page cap; `insert_record` echo is racy
- `packages/core/src/mcp/tools.ts:47-50` (`list_records`) passes `limit` straight through with
  no max (unlike the REST layer's 100 cap in `query/params.ts:21`). And `insertRecord`
  (tools.ts:84-93) re-derives "the row I just inserted" via `offset: total-1`, which can
  return a different row under concurrent inserts. Both are minor for a single-operator tool
  surface; add a cap and return the inserted row by its own id.

---

## Clean categories (explicitly verified)

- **SQL injection / query safety — CLEAN.** `query/build.ts` binds *every* value as a `?`
  parameter, and field names reach SQL only as bound parameters inside
  `json_extract(data, '$.' || ?)` (line 13) — never string-interpolated. Sort direction is
  whitelisted (`s.dir === "desc" ? "DESC" : "ASC"`, line 112), the `in`-list is
  parameter-expanded (`values.map(() => "?")`, line 49), `contains`/`q` pass `%…%` as bound
  args, and `params.ts` only admits filter/sort fields that exist in the validated collection
  schema (`schemaByName.get/has`). No path was found where a request string reaches SQL
  unparameterized. All other DB access uses Drizzle query builders; the only `client.execute`
  raw calls are the static DDL constants in `db/client.ts`.
- **Management authorization — CLEAN / defense-in-depth.** `middleware.ts` gates
  `/admin/*` and `/api/_manage/*`, *and* every `_manage` route handler independently calls
  `requireAdmin`. So even a `%5Fmanage` encoding trick that dodged the matcher still hits an
  in-handler 401. Auth is not reachable without the cookie.
- **Write-token enforcement — CLEAN.** All four write MCP tools (`insert_record`,
  `insert_records`, `update_record`, `delete_record`) call `requireWriteAccess` →
  `assertWriteToken` before mutating (`mcp/tools.ts:225-256`); the three read tools do not
  require a token, as intended. `assertWriteToken` compares hashes with `timingSafeEqual`.
- **Write-token secret handling — CLEAN.** Tokens are 24-byte random base64url
  (`auth/token.ts`), stored only as SHA-256 hex (`write_token_hash`), returned exactly once on
  create/rotate, and never included in `exportApi` or the `GET /_manage/apis` listing (which
  exposes only `hasWriteToken` boolean).
- **Public HTTP is read-only — CLEAN.** The `/api/[api]/*` routes expose only `GET`/`OPTIONS`;
  no REST write path exists. Writes are confined to MCP (token-gated) and `_manage`
  (admin-gated). Response envelope is `{data, meta}` and the `limit` cap of 100 is enforced
  server-side in `query/params.ts`.
- **CORS scope — CLEAN.** `Access-Control-Allow-Origin: *` is applied only by
  `lib/publicApi.ts` on read responses; management and MCP responses are not given permissive
  CORS. MCP auth is bearer-token (not cookie), so permissive CORS there is not a CSRF vector,
  and management cookie auth is `sameSite=lax`.
- **Request-logging robustness — CLEAN.** `logRequest` is fire-and-forget with a `.catch()`
  swallow (`publicApi.ts:67-80`); a logging failure cannot fail the request. Route JSON parse
  failures are caught and return 400.
- **Ingest front-doors — CLEAN (with a note).** JSON `rows`, `csvText`, and `tableText` all
  normalize and converge on `ingest()`; the fourth door (`_manage/import`) uses `importApi`,
  which shares the same `createCollection` + `insertRecords` primitives. Not literally one
  function, but no divergent write logic.

---

## Fix pass (2026-07-09)

All findings above were fixed on `master`. 94 unit tests green (69 baseline + 25 new), `pnpm --filter web build` green, and all 8 Playwright E2E specs green (see below — fixing this pass actually required a real bug fix beyond the plan, see "Deviation" under C1).

### C1 — signed, expiring admin session (`apps/web/lib/auth.ts`)

- Added `SESSION_SECRET`: read from env if set, otherwise a random 32-byte hex secret is
  generated once and cached — **on `globalThis`, not a plain module-scope variable** (see
  Deviation below) — with a one-time `console.warn`. Never derived from `ADMIN_PASSWORD`.
- Session cookie is now `base64url(JSON.stringify({exp})) + "." + HMAC-SHA256(that, SECRET)`,
  7-day expiry (`SESSION_TTL_MS`). New `createSession()` / `verifySession()` exports;
  `isAuthed` now delegates to `verifySession`. `requireAdmin` and the login route were
  updated to use them.
- `checkPassword` now hashes both the submitted password and the configured `ADMIN_PASSWORD`
  with `hashToken` (fixed-width SHA-256 hex) before `timingSafeEqual`, closing the
  length-timing leak (M1) as a side effect — hashed digests are always the same length, so the
  early-return length check can never actually diverge on input length.
- `SESSION_COOKIE_OPTIONS` gained `maxAge` (matching the 7-day expiry) and
  `secure: process.env.NODE_ENV === "production"` (fixes I3).
- Default `ADMIN_PASSWORD` stays `"admin"` for local dev, with the existing one-time warn.
- Tests: new `apps/web/lib/auth.test.ts` (16 tests) covering create/verify/expiry/tamper/
  wrong-secret/malformed-token, `checkPassword` correctness including different-length
  guesses, `requireAdmin`, and the `secure` flag toggling on `NODE_ENV`. Wired up by adding
  `"apps/**/*.test.ts"` to the root `vitest.config.ts` `include` and confirming the file
  actually runs under `pnpm test` (it does — see Test commands below).

**Deviation / real bug found while verifying, not just testing:** the plan said "generate a
random secret once at module load." A plain module-scope variable is *not* actually "once
per process" in this codebase: Next.js compiles `middleware.ts` (Node.js runtime) and the
various `app/api/**/route.ts` handlers as **separate bundles**, and each one gets its own
instantiation of `lib/auth.ts` when it's pulled in as a dependency. With `SESSION_SECRET`
unset (exactly the E2E harness's condition — `playwright.config.ts`'s `webServer.env` never
sets it), the login route's bundle and middleware's bundle each generated a *different* random
secret, so a session token minted by `/api/_manage/login` never verified in `middleware.ts`,
and the client bounced straight back to `/login` after a "successful" login. This was caught
by actually running the Playwright suite (`admin.spec.ts`, `create-flow.spec.ts` both failed
100% reproducibly on `expect(page).toHaveURL(/\/admin$/)`), not by the unit tests (which,
being single-module-instance by construction, couldn't see the bug). Fixed by caching the
generated secret on `globalThis` (keyed `__dap_session_secret__`, exported as
`SESSION_SECRET_GLOBAL_KEY` for tests) instead of a bare module-scope `const` — every bundle
instance within one process now shares the same generated secret, while a real process
restart still clears it (documented in `auth.test.ts`'s "without SESSION_SECRET set" test,
which explicitly clears the global to simulate that).

### I1 — gate `openapi.json` with the read key (`apps/web/app/api/[api]/openapi.json/route.ts`)

Added the same `checkReadKey(req, api)` + `logRequest` calls the other three public routes
already use, sourced from `apps/web/lib/publicApi.ts`.

**Deviation:** the task suggested factoring the check into a new `apps/web/lib/readkey.ts`.
`checkReadKey` was already factored out — it lives in `apps/web/lib/publicApi.ts` and was
already shared by the three other public routes (`[collection]/route.ts`, `[id]/route.ts`,
`random/route.ts`). Rather than introduce a second helper file that duplicates the same
export, `openapi.json/route.ts` now imports the existing one, so all four public routes share
one implementation (the actual goal — "can't drift again") without a redundant module.

### I2 — strip secrets from `exportApi` (`packages/core/src/spec/export.ts`)

`config` is now passed through an explicit allowlist (`EXPORTABLE_CONFIG_KEYS`) instead of
being copied wholesale; the list starts empty because `readKey` is the only key any code in
the repo actually reads out of `config` today (`apps/web/lib/publicApi.ts`'s `readKeyOf`) —
there's no legitimate non-secret config key in use to allowlist yet. `ApiSpec`'s top level
already has no field for secrets, so nothing to strip there. Extended
`packages/core/src/spec/spec.test.ts` with a test that sets a read key both on the dedicated
`read_key` column and at `config.readKey`, exports, and asserts neither the key name nor its
value appears anywhere in the exported spec (including a raw `JSON.stringify` substring
check, not just top-level property assertions).

### Minors

- **Reserved-slug enforcement on import + apiSlug/collectionSlug format validation:**
  consolidated into two new shared functions in `apps/web/lib/reserved.ts` —
  `validateApiSlug` / `validateCollectionSlug` — each checking required/reserved/format
  (`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`) in one place. Both `POST /_manage/apis` (create) and
  `POST /_manage/import` now call the same two functions, so collection-slug reservation
  (`openapi.json`) and slug format are enforced identically on both paths — import additionally
  now loops over every collection in the spec and validates each collection slug, not just the
  api slug. New `apps/web/lib/reserved.test.ts` covers both validators directly.
- **`list_records` MCP tool cap:** `packages/core/src/mcp/tools.ts`'s `listRecords` now
  clamps/defaults `limit` (default 25, max 100 — mirrors the REST layer's
  `query/params.ts` constants) before calling the repo. `packages/core/src/repo/records.ts`'s
  `listRecords` also gained a much looser hard ceiling (`MAX_REPO_LIMIT = 10_000`) as a
  backstop against a literally pathological `limit` reaching the DB from *any* caller,
  deliberately set above `exportApi`'s `EXPORT_PAGE_SIZE` (10,000) so the trusted internal
  export path isn't truncated — the MCP-facing 100-row cap is enforced one layer up, at the
  tool boundary, specifically because that's the untrusted-input boundary. New test in
  `packages/core/src/mcp/mcp.test.ts` inserts 150 records and asserts: no `limit` → 25 rows,
  `limit: 100_000` → clamped to 100 rows, `limit: 40` → honored as-is.

### Test commands + output

```
pnpm test
# Test Files  14 passed (14)
#      Tests  94 passed (94)

pnpm typecheck
# packages/core typecheck: Done
# apps/web typecheck: Done

pnpm --filter web build
# ✓ Compiled successfully, all 18 routes built

pnpm --filter web exec playwright test
# 8 passed (34.5s) — chromium launched fine in this sandbox; no limitation hit.
```

### Manual verification (production build, plain HTTP, non-default port)

```
$ ADMIN_PASSWORD=test SESSION_SECRET=test-secret NODE_ENV=production next start -p 3498

POST /api/_manage/login {"password":"test"}
  -> 200, Set-Cookie: dap_session=<payload>.<sig>; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=lax

GET /api/_manage/apis  (with the valid cookie)      -> 200 {"apis":[]}
GET /api/_manage/apis  (no cookie)                  -> 401 {"error":"Unauthorized"}
GET /api/_manage/apis  (last cookie char flipped)   -> 401 {"error":"Unauthorized"}
POST /api/_manage/login {"password":"wrong"}        -> 401 {"error":"Invalid password"}
```

Server killed after verification.
