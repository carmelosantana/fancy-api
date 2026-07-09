# Declarative API Platform — Implementation Plan

> **For agentic workers:** implement task-by-task, TDD, commit per task.

**Goal:** Ship a self-hostable, AGPL, read-only queryable API generator with an
MCP write surface for AI agents, proven by the "Hello Tony" quotes demo.

**Architecture:** pnpm monorepo. `packages/core` holds all framework-agnostic
logic (Drizzle schema, JSON-store data-access, query builder, CSV/table type
inference, declarative import/export, MCP tool handlers). `apps/web` is a
Next.js App Router app binding that logic to HTTP: builder UI, public read API,
and an MCP endpoint. SQLite by default (single container + volume); Postgres
supported as an optional compose profile.

**Tech Stack:** TypeScript, pnpm workspaces, Next.js 15 (App Router), Drizzle
ORM + better-sqlite3, Zod, PapaParse, @modelcontextprotocol/sdk via mcp-handler,
Tailwind, Vitest, Playwright, Docker Compose.

## Global Constraints

- License: **AGPL-3.0**. Include `LICENSE` and SPDX headers optional.
- Default DB: **SQLite** file at `DATABASE_PATH` (default `./data/app.db`).
  `DATABASE_URL=postgres://…` selects Postgres (optional profile).
- Public HTTP API is **read-only**. All writes go through MCP (per-API write
  token) or the builder UI ingest.
- Builder UI protected by single admin credential `ADMIN_PASSWORD` (env).
- Response envelope: `{ data, meta: { total, limit, offset } }`.
- Ship seeded **Hello Tony** quotes so the demo works immediately.

---

### Task 1: Monorepo + tooling scaffold
**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
`.gitignore`, `packages/core/package.json`, `apps/web/package.json`.
- Root pnpm workspace (`packages/*`, `apps/*`), shared TS config, Vitest at root.
- Deliverable: `pnpm install` + `pnpm -r typecheck` succeed on empty stubs.
- Commit.

### Task 2: core — DB schema & connection (Drizzle + SQLite)
**Files:** `packages/core/src/db/schema.ts`, `db/client.ts`, `db/migrate.ts`;
`tests/db.test.ts`.
- Tables: `apis`, `collections`, `records`, `request_log` (per spec §5).
- `getDb(path)` returns a Drizzle client over better-sqlite3; auto-creates tables.
- Test: create db in `:memory:`, insert an api row, read it back.
- Commit.

### Task 3: core — type inference
**Files:** `src/ingest/infer.ts`; `tests/infer.test.ts`.
- `inferColumns(rows: Record<string,string>[]) => ColumnSchema[]` mapping cells
  to `string|number|boolean|date`; `coerceRow(row, schema)` returns typed values.
- Tests: numbers, booleans (`true/false/yes/no`), ISO dates, mixed→string.
- Commit.

### Task 4: core — CSV / table parsing
**Files:** `src/ingest/parse.ts`; `tests/parse.test.ts`.
- `parseCsv(text)` (PapaParse) and `parseDelimited(text)` (TSV/paste) → rows.
- Tests: CSV with header, TSV paste, quoted fields.
- Commit.

### Task 5: core — query builder over JSON store
**Files:** `src/query/build.ts`, `src/query/params.ts`; `tests/query.test.ts`.
- `parseQuery(searchParams, schema)` → structured `{filters, sort, limit,
  offset, q}`. Operators via suffix: `field`, `field_gt/gte/lt/lte/ne/contains/in`.
- `runQuery(db, collectionId, q)` → `{ data, total }` using SQLite `json_extract`.
- `randomRecord(db, collectionId)`; `getById(db, collectionId, id)`.
- Tests: eq, gt, contains, sort desc, limit/offset, search `q`, random, by-id.
- Commit.

### Task 6: core — repository (writes) + ingest pipeline
**Files:** `src/repo/apis.ts`, `src/repo/records.ts`, `src/ingest/pipeline.ts`;
`tests/pipeline.test.ts`.
- `createApi`, `createCollection`, `insertRecords`, `updateRecord`,
  `deleteRecord`, `listRecords`.
- `ingest({apiSlug, collectionSlug, rows})` → infer schema, create/find
  collection, insert records. All four front-doors funnel here.
- Test: ingest quotes rows → query them back through Task 5.
- Commit.

### Task 7: core — declarative import/export
**Files:** `src/spec/export.ts`, `src/spec/import.ts`, `src/spec/types.ts`;
`tests/spec.test.ts`.
- `exportApi(db, apiSlug)` → declarative object (YAML/JSON serializable) with
  config + inline data. `importApi(db, spec)` round-trips it into the DB.
- Test: ingest → export → wipe → import → identical query results.
- Commit.

### Task 8: core — MCP tool handlers
**Files:** `src/mcp/tools.ts`; `tests/mcp.test.ts`.
- Pure handlers: `list_records, get_record, query_records, insert_record,
  insert_records, update_record, delete_record` — each `(db, apiId, args)`.
- Token check helper `assertWriteToken(api, token)`.
- Test: insert via handler, read back; bad token rejected.
- Commit.

### Task 9: web — Next.js scaffold + Tailwind + auth
**Files:** `apps/web/` app router, `middleware.ts`, `lib/db.ts`, `lib/auth.ts`.
- `lib/db.ts` opens core db (singleton). `ADMIN_PASSWORD` cookie session guards
  `/` builder and `/api/_manage/*`; public read API unguarded.
- Deliverable: dev server boots, login works.
- Commit.

### Task 10: web — public read API routes
**Files:** `app/api/[api]/[collection]/route.ts`, `.../[id]/route.ts`,
`.../random/route.ts`, `app/api/[api]/openapi.json/route.ts`.
- Bind Task 5 query builder; write `request_log`; enforce optional read-key;
  auto OpenAPI doc. Envelope responses.
- Commit.

### Task 11: web — MCP endpoint
**Files:** `app/api/mcp/[api]/route.ts` using `mcp-handler` + Task 8 tools.
- Streamable HTTP transport; per-API write token from header/query.
- Commit.

### Task 12: web — Builder UI (the fun part)
**Files:** `app/page.tsx` (dashboard), `app/apis/[slug]/page.tsx`,
`app/new/page.tsx`, components for paste/CSV upload, live playground, token
reveal, import/export, confetti on create.
- Management API routes under `app/api/_manage/*` (create api, ingest, export).
- A live "Try it" panel: shows curl + fires the request + renders JSON; a random
  quote widget. Confetti + playful copy.
- Commit.

### Task 13: seed + Hello Tony demo data
**Files:** `packages/core/src/seed.ts`, `scripts/seed.ts`, quotes dataset.
- `pnpm seed` populates a `hello-tony` API with `quotes` collection.
- Commit.

### Task 14: Playwright E2E
**Files:** `apps/web/e2e/*.spec.ts`, `playwright.config.ts`.
- Flows: login → create API by paste → hit generated endpoint → `/random` →
  filter query → export file. Assert real HTTP responses.
- Commit.

### Task 15: Docker + Makefile + README
**Files:** `Dockerfile`, `docker-compose.yml` (sqlite default; postgres profile),
`Makefile` (`up down dev test seed logs clean`), `README.md`, `LICENSE`.
- `make up` builds + runs; volume-persisted sqlite; healthcheck.
- README: quickstart, the four ingest methods, query syntax, MCP usage, self-host.
- Commit.

### Task 16: Launch + BigBucket autostart
- Build, run, Playwright green, register with BigBucket for boot autostart,
  produce the demo URL.

## Self-Review
- Spec coverage: §4 arch → T1,T2,T9; §5 model → T2; §6 ingest → T3,T4,T6;
  §7 read API → T5,T10; §8 MCP → T8,T11; §9 auth → T9; testing §11 → T2–T8,T14;
  demo → T13,T16. Covered.
- No placeholders: task deliverables + test intents concrete.
- Types: `ColumnSchema`, envelope, tool signatures consistent across tasks.
