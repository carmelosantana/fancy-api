# Declarative API Platform — Design Spec

**Date:** 2026-07-08
**Status:** Approved design → ready for implementation planning
**Working name:** Declarative API Platform (final name TBD)

---

## 1. Summary

An open-source (AGPL) tool that turns tabular data into a live, queryable,
read-only REST API in minutes, and lets AI agents write to that data over an
MCP server. Self-hostable via Docker. A hosted version can wrap the same core
later.

Inspired by "Hello Tony," which has nowhere to store its quotes: point this at
a table of quotes and get `GET /api/hello-tony/quotes?author=X`, `/random`,
sorting, and pagination — plus an MCP endpoint an agent can use to add and
maintain quotes dynamically.

## 2. Goals & non-goals

### Goals
- **The Hello Tony test:** paste a table of quotes → a running, queryable API
  in under 5 minutes.
- Open-source, **AGPL**, self-host-first via **Docker Compose**.
- Runs on **SQLite** (dead-simple) *or* **Postgres** (scale) with no code change.
- **AI-native:** an MCP server is a first-class write surface.
- Reusable core: the engine is a package others can embed.

### Non-goals for v1 (deferred to the hosted wrapper — see §10)
- Public REST **writes/CRUD** (writes go through MCP instead).
- Multi-user accounts and **OAuth** (GitHub/Discord).
- **Gamification**, leaderboards, badges.
- **Billing / tiers**, subdomains, custom domains.

## 3. Primary decisions (locked)

| Decision | Choice |
|---|---|
| Product shape | OSS dev tool, self-host first; hosted layer later |
| Generated API surface | Read-only + query (filter/sort/paginate/search/random) |
| Row storage | **Generic JSON store** (fixed meta-tables, JSON `data` column) |
| DB abstraction | **Drizzle ORM**, SQLite or Postgres |
| Source of truth | **DB at runtime**; declarative file is portable import/export |
| Runtime shape | **Monorepo**: `packages/core` + single **Next.js** app |
| Write surface | **MCP server** (records CRUD + query), per-API write token |
| Auth (v1) | Single admin credential for builder; public reads; optional read-key |
| Containers | **2** (web + db) via Docker Compose |

## 4. Architecture

```
                       ┌───────────────────────────────┐
                       │  apps/web  (Next.js)           │
                       │                                │
  admin (browser) ────▶│  Builder UI  (/admin)          │
                       │   paste / CSV / edit / import  │
                       │                                │
  apps / anyone ──────▶│  Read API   /api/{api}/{coll}  │──┐
                       │   filter·sort·page·search·rand │  │
                       │   + OpenAPI doc per API        │  │   ┌──────────┐
  AI agents ──────────▶│  MCP endpoint  /mcp            │──┼──▶│    DB    │
                       │   records CRUD + query tools   │  │   │ Postgres │
                       └───────────────────────────────┘  │   │ or SQLite│
                                    │                      │   │ (Drizzle)│
                                    └── imports ───────────┘   └──────────┘
                                    ▼
                       ┌───────────────────────────────┐
                       │  packages/core                 │
                       │  drizzle schema + migrations   │
                       │  data-access (JSON store)      │
                       │  query builder                 │
                       │  type inference (CSV/table)    │
                       │  declarative import/export     │
                       │  MCP tool handlers             │
                       └───────────────────────────────┘
```

**`packages/core`** is framework-agnostic and holds all real logic. The Next.js
app is a thin transport binding (route handlers). This keeps the engine
embeddable/liftable into a standalone service later without a rewrite.

## 5. Data model (fixed meta-tables, via Drizzle)

- **`apis`** — `id`, `slug` (unique), `name`, `description`, `config` (JSON:
  query defaults, optional public read-key), `write_token` (hashed),
  `created_at`, `updated_at`.
- **`collections`** — `id`, `api_id`, `slug`, `name`, `schema` (JSON: inferred
  columns + types), `created_at`, `updated_at`. An API may have >1 collection
  (e.g. `quotes`, `authors`).
- **`records`** — `id`, `collection_id`, `data` (JSON row), `seq` (stable
  ordinal), `created_at`, `updated_at`. All filtering/sort/paginate/search run
  over `data`.
- **`request_log`** (stub) — `id`, `api_id`, `ts`, `method`, `path`, `status`.
  Foundation for the deferred usage/gamification layer; written cheaply in v1,
  surfaced later.

Type inference maps CSV/table cells to `string | number | boolean | date` and
stores the inferred column schema on the collection. JSON access uses SQLite
`json1` / Postgres `JSONB` behind the Drizzle data-access layer.

## 6. Ingest pipeline (one path, four front-doors)

`paste-table` · `upload-CSV` · `paste-CSV` · `declarative-file`
→ **parse → infer column types → build/merge spec → write config + records to DB.**

Export reverses it: DB → a portable **declarative file** (YAML/JSON) containing
config + inline data, git-friendly and re-importable. This is what makes the
platform "declarative" without parsing files at request time.

## 7. Generated read API (public)

Per collection:
- `GET /api/{api}/{collection}` — list
- `GET /api/{api}/{collection}/{id}` — by id
- `GET /api/{api}/{collection}/random` — random record

Query params:
- Field filters with operators: `?author=X`, `?year_gt=1990`, `?year_lte=2000`,
  `?text_contains=hope` (operator set: `eq, ne, gt, gte, lt, lte, contains, in`).
- `sort=-year,author` (prefix `-` = descending).
- `limit` / `offset` pagination (sane defaults + max caps).
- `q=` search across string fields.

Response envelope: `{ "data": [...], "meta": { "total", "limit", "offset" } }`.

**OpenAPI:** each API auto-generates an OpenAPI document (served at e.g.
`/api/{api}/openapi.json`), reinforcing the "platform" feel and enabling client
generation / docs UI.

**Access:** public by default; if an API sets a read-key, requests must present it.

## 8. MCP server (write surface for AI agents)

Served at `/mcp` over the **Streamable HTTP transport**. Authenticated per-API
by a **write token**. Tools (scoped to an API/collection):

- `list_records` / `get_record` / `query_records` — read-before-write support.
- `insert_record` / `insert_records` (bulk).
- `update_record` / `delete_record`.

Collections and APIs themselves are created in the Builder UI in v1 (schema
management via MCP is deferred). The public internet stays **read-only**; all
writes require the MCP write token.

## 9. Auth (v1)

- **Builder UI** — single admin credential (env-configured; session cookie).
- **Read API** — public by default; optional per-API read-key.
- **MCP** — per-API write token (shown once in the Builder UI, stored hashed).

## 10. Roadmap beyond v1 (the hosted wrapper)

The v1 core is deliberately shaped so these bolt on without rework:

- **Usage tracking** — build dashboards off `request_log` (per-API counts,
  latency, popularity).
- **OAuth (GitHub/Discord) + multi-user** — real accounts, per-user API
  ownership, isolation.
- **Gamification** — badges, streaks, leaderboards of popular community APIs,
  "your API served 10k requests" milestones — driven off usage data.
- **Hosted SaaS** — sign-up on your domain, subdomains/custom domains,
  tiers/billing, all wrapping the same `packages/core`.

## 11. Testing strategy

- **`packages/core` unit tests** — type inference, query builder (each operator,
  sort, pagination, search), import/export round-trip, JSON-store data-access
  against both SQLite and Postgres.
- **Read API integration tests** — the Hello Tony scenario end-to-end.
- **MCP tool tests** — each tool with token auth (happy path + rejection).
- **Ingest tests** — all four front-doors converge to identical DB state.

## 12. Open questions (non-blocking; resolve during planning)

- Final product name.
- Declarative file format: YAML vs JSON as default (support both on import).
- Search implementation depth for v1 (naive substring vs DB full-text).
- Multi-collection UX in the builder for v1 vs single-collection first.
