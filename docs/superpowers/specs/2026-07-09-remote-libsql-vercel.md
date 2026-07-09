# Remote libsql (Vercel + self-hosted sqld) — Design

**Date:** 2026-07-09
**Status:** Approved → implementing

## Goal
Let Fancy run on **Vercel** (or any serverless/ephemeral-FS host) by connecting to a
**remote libsql** database instead of a local SQLite file — specifically a
**self-hosted `sqld` (libsql-server)** the operator runs on a small VPS. Keep the
existing local-file mode (localhost + Docker) working unchanged. Postgres remains a
non-goal; the query engine stays SQLite (`json_extract`) because remote libsql *is* SQLite.

## Why this shape
`packages/core` already talks to SQLite via `@libsql/client`'s `createClient({ url })`.
Remote libsql is the same client + protocol, so the query builder, repo, ingest, spec,
and MCP layers change **zero lines**. This is far smaller than a Postgres port (which
would mean a JSONB query rewrite + a second Drizzle dialect + dual-DB tests).

## Changes

### 1. Storage selection (both modes coexist)
Precedence, resolved in `packages/core/src/paths.ts` (used by `apps/web/lib/db.ts` and
`scripts/seed.ts`):
- If `DATABASE_URL` is a remote libsql URL (`libsql://`, `http://`, `https://`) →
  **remote** mode, with `DATABASE_AUTH_TOKEN` as the auth token.
- Else → **local file** mode via `DATABASE_PATH` (today's behavior, default
  `/data/app.db`).
Expose a single resolver, e.g. `resolveDbConfig(): { url: string; authToken?: string }`.

### 2. Engine (`packages/core/src/db/client.ts`)
- `getDb(url?, authToken?)` → `createClient({ url, authToken })`.
- Use the **`@libsql/client/web`** entry (pure HTTP, no native binding) for remote URLs
  so the Vercel bundle never needs the native `libsql`; keep the native `@libsql/client`
  for `file:` / `:memory:`. Select by URL scheme.
- `ensureSchema` (raw `CREATE TABLE IF NOT EXISTS`) is unchanged — runs on remote libsql
  as-is; idempotent on serverless cold start.

### 3. Serverless correctness — request logging
`logRequest` (in `apps/web/lib/publicApi.ts`) is fire-and-forget. On Vercel the function
suspends the moment the response returns, so a pending write to a *remote* DB is dropped.
Fix: wrap the insert in Next.js **`after()`** (`next/server`) so it completes
post-response. `after()` is a no-op-equivalent on local/Docker (still runs after the
response), so behavior there is identical. `logRequest` lives in web (not core), so
importing `next/server` there keeps `packages/core` framework-agnostic.

### 4. Seeding
On-start seeding stays for the Docker/file path. For remote, seeding is a one-time step:
`DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm seed` (the seed script already uses the
shared resolver, so this "just works" once the resolver understands remote URLs).

### 5. Self-hosted `sqld` (the database)
Add `docker-compose.sqld.yml` (or a documented `docker run`) for
`ghcr.io/tursodatabase/libsql-server`: a persistent volume for its `.db`, an auth
(JWT) token, exposed over HTTPS. Document generating the token and the client URL.
`sqld` is a single lightweight process — the "self-hosted, smaller the better" answer.

### 6. Vercel deploy + docs
- pnpm-monorepo build config for Vercel (root dir / build command so `apps/web` builds
  with the `@app/core` workspace dep) — a minimal `vercel.json` and/or documented
  dashboard settings.
- README: **"Deploy on Vercel (with self-hosted libsql)"** — env vars
  (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`), build
  settings, the seed-once step. Note `output: "standalone"` is harmless on Vercel
  (Vercel builds Next natively).
- `AGENTS.md`: storage note becomes "local file **or** remote libsql; Postgres roadmap."

## Testing / verification
- Unit: `resolveDbConfig` precedence (remote URL beats file path; token passthrough);
  client selection by URL scheme.
- Integration (if Docker available here): run a local `sqld` container, point `getDb`
  at it with a token, `ensureSchema` + insert + query round-trip. Fall back to a mocked
  test if `sqld` can't run in the sandbox.
- Existing unit + Playwright suites stay green (local-file path unchanged).
- **Not verifiable here:** an actual Vercel deploy — write the config correct-by-
  construction and document it; do not claim a Vercel deploy happened.

## Non-goals
- Postgres / Supabase (still roadmap).
- Automatic migration of existing local data (use the declarative export/import).
- Multi-region / embedded-replica tuning (single remote DB for now).
