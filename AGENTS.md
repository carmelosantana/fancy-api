# AGENTS.md

Guardrails for anyone (human or agent) changing Fancy. Full design spec:
[`docs/superpowers/specs/`](docs/superpowers/specs/).

## Architecture
- Monorepo. **`packages/core`** holds all framework-agnostic logic (Drizzle schema,
  JSON-store data-access, query builder, ingest, spec import/export, MCP tools, auth).
  **`apps/web`** is a thin Next.js binding. Put logic in `core`, not in routes.
- Prefer small, focused files. TDD: tests live next to source (`*.test.ts`).

## Hard rules (don't break these)
- **Public HTTP API is read-only.** Never add public REST writes. Writes go only through
  the **MCP** endpoint (per-API bearer token) or the admin builder ingest.
- **SQL safety:** query field *names* come only from the validated collection schema;
  user *values* are always parameterized (`json_extract`). Never interpolate request input.
- **Secrets:** write tokens are stored hashed and shown once; `exportApi` must strip
  secrets. Real secrets live only in gitignored `.env` — never commit them. `.superpowers/`
  build logs are gitignored too.
- **No native-compiled deps** (Node 26): SQLite is `@libsql/client`, not better-sqlite3.

## Storage & query
- Generic JSON store: `apis → collections → records(data JSON)` + `request_log`.
- **SQLite only today** (libsql) — via **local file** (`DATABASE_PATH`, Docker/localhost) **or
  remote libsql** (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`, e.g. self-hosted sqld / Turso, for
  Vercel/ephemeral-FS hosts). Same engine/protocol either way; `resolveDbConfig()`
  (`packages/core/src/paths.ts`) picks one. Postgres still roadmap (query layer uses SQLite
  `json_extract`). Single instance only — no horizontal scaling against one DB.
- List envelope is `{ data, meta:{ total, limit, offset } }`. `limit` default 25, max 100.
- Query ops are suffix-style: `field`, `field_gt|gte|lt|lte|ne|contains|in`, plus `sort`
  (`-field` desc, `random`), `offset`, `q`.
- Reserved slugs: api `_manage`, `mcp`; collection `openapi.json`.

## Auth & CORS
- Single admin via `ADMIN_PASSWORD`; session cookie is HMAC-signed with `SESSION_SECRET`
  (required in prod, else sessions drop on restart), `Secure` in production → serve over HTTPS.
- Public read routes send `Access-Control-Allow-Origin: *` + preflight (any origin may consume).
  MCP/management are intentionally not browser-CORS-enabled.

## Next.js / build gotchas
- `next.config.ts`: `output: "standalone"`, `outputFileTracingRoot` = repo root,
  `serverExternalPackages: ["@libsql/client","libsql"]`, `transpilePackages: ["@app/core"]`.
- Management routes live on disk at `app/api/%5Fmanage/…` (escaped underscore) but serve at
  `/api/_manage/…` — Next treats a literal `_manage` folder as private.
- DB connection resolves via `packages/core/src/paths.ts`'s `resolveDbConfig()`: a remote
  `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN`) wins if it's `libsql://`/`http(s)://`/`ws(s)://`-shaped,
  else falls back to the local file path (`DATABASE_PATH`, default `/data/app.db`).
- `getDb()` (`packages/core/src/db/client.ts`) picks the client by URL scheme:
  `@libsql/client/web` (pure HTTP, no native binding — Vercel-safe) for remote URLs, the native
  `@libsql/client` for `file:`/`:memory:`.

## Before you ship
- Keep `pnpm test` (unit) and `pnpm e2e` (Playwright) green.
- Deploy needs a persistent volume at `/data` or SQLite is wiped on redeploy.
- License: **AGPL-3.0**.
