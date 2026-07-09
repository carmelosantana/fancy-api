# Task 12 report — Frontend for the Declarative API Platform

## Product name

**Fancy** — tagline: "Paste data. Get a fancy API." Plays on both the adjective
and the repo/dir name (`fancy`). Shown in the nav wordmark (⚡ mark + "Fancy."),
page `<title>`, and copy throughout ("ship an API before your coffee's cold").

## Commit range

`79043ea..2a3b010` (5 commits, all prefixed `Task 12:`):

1. `79043ea` — stats aggregation route + canvas-confetti dependency
2. `26a17b4` — design system, shared components, public landing + login
3. `6fe414e` — admin dashboard + create wizard
4. `41f56a1` — API detail page (endpoints, playground, records, MCP, actions)
5. `2a3b010` — fix single-day sparkline stretch + add dev launch config

## Backend addition (as instructed)

`GET /api/_manage/apis/[slug]/stats` (admin-protected via `requireAdmin`,
mirrors the other `%5Fmanage` routes exactly — same cookie check, same
`NextResponse.json` error shape).

Implementation lives mostly in `@app/core` (consistent with the existing
"routes are thin, `@app/core` owns the DB logic" pattern):

- `packages/core/src/repo/stats.ts` — new `getApiStats(db, apiId)`:
  - `totalRecords`: sums `listRecords(db, collectionId, { limit: 0 })`'s
    `total` across every collection (the `limit: 0` skips fetching row data;
    `listRecords` still runs its count query regardless of limit/offset).
  - `totalRequests` + `requestsByDay`: selects `requestLog.ts` for the api,
    buckets by UTC calendar day (`YYYY-MM-DD`), sorted ascending.
  - `byCollection`: per-collection `{ slug, name, totalRecords }`.
- Exported from `packages/core/src/index.ts` via `export * from "./repo/stats"`.
- `packages/core/src/repo/stats.test.ts` — 2 new vitest cases (aggregation
  across collections/days; zeroed stats for an empty api). All 67 core tests
  pass (`pnpm vitest run`).
- `apps/web/app/api/%5Fmanage/apis/[slug]/stats/route.ts` — thin route:
  `requireAdmin` → `getApiBySlug` (404 if missing) → `getApiStats` → JSON.

I considered querying `requestLog` directly from the web route with
drizzle-orm operators, but `drizzle-orm` isn't a direct dependency of
`apps/web` (only of `@app/core`) — pulling it in just for the route would
duplicate the DB-logic-lives-in-core convention every other route follows,
so the aggregation went into core instead.

## Pages & components built

### Design system
- `apps/web/tailwind.config.ts` — `canvas`/`surface` dark palette, `brand.violet`/`brand.cyan`,
  gradient `backgroundImage` utilities, `shadow-glow`/`shadow-card`, `fade-up`/`pop`/`shimmer` keyframes.
- `apps/web/app/globals.css` — fixed `.app-backdrop` (grid + two radial glows, masked to fade
  toward the bottom), `.text-gradient`, `.card`, `.btn-primary/secondary/danger`, `.input`,
  `.badge-pill` component classes so every page shares one visual language without repeating
  long utility strings.
- `apps/web/app/layout.tsx` — dark html class, canvas background, mounts the backdrop.

### Shared components (`apps/web/components/`)
- `ui/CopyButton.tsx`, `ui/CodeBlock.tsx`, `ui/JsonView.tsx` — copy-to-clipboard with a
  "Copied!" flip state (falls back to `execCommand` if the Clipboard API is unavailable).
- `ui/Badge.tsx` (`Badge`, `BadgeRow`) — milestone pills, empty-state copy when none earned.
- `ui/StatCounter.tsx` — requestAnimationFrame count-up (ease-out-cubic) for record/request numbers.
- `ui/Tabs.tsx`, `ui/ConfirmDialog.tsx`, `ui/LogoutButton.tsx`.
- `NavBar.tsx` — `Logo`, `PublicNav`, `AdminNav` (back link, Dashboard/+New API/Sign out).
- `McpConfigSnippet.tsx` — ready-to-paste `{ mcpServers: { <slug>: { url, headers: { Authorization } } } }`
  JSON, used with a real token (create/rotate reveal) or a `YOUR_WRITE_TOKEN` placeholder (detail page).
- `landing/LiveQuoteWidget.tsx` — polls `/api/hello-tony/quotes/random` every 6s + manual refresh;
  degrades to a "seed the demo" hint on 404, and to an error message on network failure — never blank.
- `landing/PlaygroundWidget.tsx` — free-text query string against `/api/hello-tony/quotes`, shows
  status badge, JSON response, and the equivalent `curl`.
- `admin/ApiCard.tsx`, `admin/TablePreviewTable.tsx`, `admin/CreateSuccessPanel.tsx`,
  `admin/TokenRevealCard.tsx` (shared by both the wizard and the detail page's rotate flow),
  `admin/FilterPlayground.tsx` (field+op+value filter builder → query string, curl, raw response),
  `admin/RecordsTable.tsx`, `admin/ApiDetailClient.tsx`.
- `lib/confetti.ts`, `lib/milestones.ts`, `lib/slug.ts`, `lib/previewParse.ts` (client-only
  heuristic delimiter-sniffing table parser for the pre-submit preview — intentionally simple;
  real parsing is server-side PapaParse via `@app/core`).

### Pages
1. **`app/page.tsx`** (public) — hero with gradient headline, live demo widget + query
   playground side-by-side, 3-step "How it works", 4 feature cards (query syntax, MCP writes,
   self-host, OSS/AGPL), closing CTA.
2. **`app/login/page.tsx`** — polished card, default-password hint (`admin`/`ADMIN_PASSWORD`).
3. **`app/admin/page.tsx`** (server) — fetches `listApis` + `listCollections` + `getApiStats`
   per api directly via `@app/core`/`db()` (no self-HTTP round trip), renders `ApiCard` grid with
   animated counters + milestone badges; encouraging empty state.
4. **`app/admin/new/page.tsx`** (client) — name/slug (auto-slugify, editable), 4-tab ingest
   picker (paste table / upload CSV / paste CSV / import spec), live client-side table preview
   with inferred column-type badges, confetti + success panel on create (endpoints, live
   "try it" fetch, one-time write-token reveal + MCP config for the two direct-ingest paths;
   import has no token since `importApi` never generates one — panel says so and links to the
   detail page to rotate one).
5. **`app/admin/apis/[slug]/page.tsx`** (server) → `ApiDetailClient` (client) — usage header
   (animated counters, 7-day request sparkline, badges), collection picker when >1 collection,
   endpoints panel, `FilterPlayground`, `RecordsTable` preview, MCP connect section, and actions
   (export yaml/json via anchor tags, rotate-token → confirm dialog → one-time reveal, delete →
   confirm dialog → redirect to dashboard).

## Build / verification

- `pnpm --filter web build` — green (checked after every commit; final run above).
- `pnpm -r --if-present typecheck` — green (`packages/core`, `apps/web`).
- `pnpm vitest run` — 67/67 passing (11 files), including the 2 new `stats.test.ts` cases.
- Runtime smoke test via `next dev` (through the preview tooling, `.claude/launch.json` added):
  - `curl /` → 200, `/login` → 200, `/admin` (no cookie) → 307 to `/login`, same for `/admin/new`.
  - Logged in (`POST /api/_manage/login {password: admin}`), then with a valid session cookie:
    `/admin`, `/admin/new`, `/admin/apis/hello-tony` all → 200.
  - Created a real `hello-tony/quotes` API via `POST /api/_manage/apis` (3 quotes) to exercise
    the landing page's live widget end-to-end — confirmed `GET /api/hello-tony/quotes/random`
    returns real data and the widget renders it.
  - Screenshotted: landing hero + live widget + playground (with a real query executed and JSON
    shown), admin dashboard (real counters/badges), API detail page (endpoints, sparkline,
    records table, MCP config, actions), rotate-token confirm dialog → one-time reveal panel,
    create wizard (auto-slug, live preview with type badges, disabled-until-valid submit,
    confetti + success panel with a real generated write token).
  - No server errors in `preview_logs`.
  - Cleaned up test data (`DELETE /api/_manage/apis/sci-fi-books`) and removed the local
    `apps/web/data/` sqlite file (gitignored) before finishing.

## Deviations / notes

- `getApiStats` lives in `@app/core` rather than being inlined in the route, to keep with the
  existing "core owns DB logic" convention and avoid adding `drizzle-orm` as a direct `apps/web`
  dependency just for one route.
- The client-side table preview (`lib/previewParse.ts`) is a deliberately simple heuristic
  (delimiter-sniffing, no quoted-field escaping) — it's cosmetic, shown before submit; the actual
  ingest still goes through `@app/core`'s PapaParse-backed parser server-side, so a preview
  mismatch on edge-case CSVs (quoted commas, etc.) can't cause bad data, only a slightly
  inaccurate preview.
- Declarative-import success has no write-token reveal, because `importApi()` in `@app/core`
  never sets `writeTokenHash` — this matches the backend's actual behavior rather than
  papering over it; the success panel says so explicitly and links to the detail page's
  rotate-token action.
- No new page-level `not-found.tsx` was added for a missing `/admin/apis/[slug]`; it falls back
  to Next's default 404 via `notFound()`. Not called out in the spec as required, and time was
  prioritized on the core flows.
- `.claude/launch.json` was added (wasn't present before) purely to drive `next dev` through the
  preview tooling for smoke testing; it's a dev-only convenience, not part of the shipped app.
