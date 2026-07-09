# Tasks 13-14 report: seed data + Playwright E2E

## Part 1: DB path resolution decision

**Problem:** the web app (`apps/web/lib/db.ts`) and the seed script must open the
exact same sqlite file, regardless of which directory each process is launched
from (`pnpm dev` runs with cwd `apps/web`; `pnpm seed` runs with cwd repo root).

**Decision:** a single shared function, `packages/core/src/paths.ts`, is the one
place this logic lives — both `apps/web/lib/db.ts` and `scripts/seed.ts` import
and call it, so there's no way for them to independently drift apart.

- `findRepoRoot(startDir = process.cwd())` walks up from `startDir` until it
  finds a directory containing `pnpm-workspace.yaml`. This works no matter
  which package's directory the calling process happens to start in.
- `resolveDbUrl(startDir?)`:
  - If `DATABASE_PATH` is set: relative values are resolved **against the
    repo root** (not `process.cwd()`), so `DATABASE_PATH=./data/e2e.db` means
    the same file whether it's read by `next start` (cwd `apps/web`) or a
    script run from the repo root. Absolute values are used as-is.
  - Otherwise defaults to `<repoRoot>/data/app.db`.
  - Always returns a `file:` URL, ready for `getDb()`.
- `ensureDbDir(url)`: creates the parent directory of a `file:` URL if it
  doesn't exist yet (also shared, previously duplicated inline in
  `apps/web/lib/db.ts`).

Both exported from `@app/core`'s barrel (`index.ts`). `apps/web/lib/db.ts` was
simplified to just call `resolveDbUrl()` + `ensureDbDir()` instead of carrying
its own path logic.

Verified: `DATABASE_PATH=/tmp/.../app.db pnpm seed` and `pnpm seed` (no env,
default) both resolve and write to the expected absolute path; `pnpm build`
+ `pnpm dev` unaffected (dev DB now lives at `<repoRoot>/data/app.db`,
confirmed via checksum before/after running the E2E suite — untouched).

## Part 1: seed contents

`packages/core/src/seed.ts` exports `seedHelloTony(db, { overwrite? })`:

- Creates api slug `hello-tony` / name "Hello Tony", collection `quotes`
  (schema: `author` string, `text` string, `year` number, `topic` string).
- 22 quotes — real, well-known lines (Churchill, Angelou, Jobs, T. Roosevelt,
  E. Roosevelt, Edison, Einstein, Twain, Disney, Mandela, Oprah, Ford,
  Earhart, Dr. Seuss, Jim Rohn, Lombardi, Ziglar, Ali, Chanel, Tony Robbins,
  J.K. Rowling, Gretzky) spanning 1890-2005, topics: perseverance, resilience,
  life, confidence, dreams, opportunity, productivity, action, wisdom,
  mindset, creativity, growth, motivation, choices, sports.
- Idempotent: if `hello-tony` already exists and `overwrite` isn't set, it's
  a no-op returning `{ apiId, inserted: 0 }`. `overwrite: true` calls
  `deleteApi` first, then re-ingests fresh (used by `SEED_OVERWRITE=1`).
- Unit test `packages/core/src/seed.test.ts`: seeds into `:memory:`, asserts
  the collection schema/field types and `total > 15`; second call is a no-op
  (record count unchanged). Both tests pass.

`scripts/seed.ts` (root `pnpm seed`) resolves the shared DB URL, ensures the
schema, calls `seedHelloTony`, and logs the four demo endpoints. Root
`package.json` gained `@app/core: workspace:*` (dependency) and `tsx`
(devDependency) so the script can `import { ... } from "@app/core"` directly.

`pnpm test`: **69/69 green** (67 pre-existing + 2 new seed tests).

## Part 2: Playwright config approach

- `apps/web/e2e/testEnv.ts`: single source of truth for
  `E2E_DB_PATH`/`E2E_PORT`/`E2E_BASE_URL`/`E2E_ADMIN_PASSWORD`, imported by
  both `playwright.config.ts` (sets `webServer.env`) and
  `e2e/global-setup.ts` (seeds that same file directly) — guarantees they
  can't point at different databases.
- `apps/web/e2e/global-setup.ts`: opens `E2E_DB_PATH`, `ensureSchema`, then
  `seedHelloTony(db, { overwrite: true })` so every run starts from the same
  deterministic 22 quotes. Deliberately does **not** delete the sqlite file
  itself (only the hello-tony rows within it) — since `reuseExistingServer`
  may keep a `next start` process holding that file open across local runs,
  unlinking it out from under a live connection would be asking for trouble.
- `apps/web/playwright.config.ts`: `testDir: "./e2e"`, `baseURL` from
  `testEnv`, `webServer.command: "next build && next start -p <port>"`
  (production build, not dev server), `reuseExistingServer: !CI`, 180s
  timeout, `env: { DATABASE_PATH, ADMIN_PASSWORD, PORT }` all pointing at the
  dedicated test DB/port.
- **Port deviation from the spec's example (3100):** port 3100 is
  permanently owned on this dev box by a systemd-user-supervised BigBucket
  service (`bigbucket-newburgh-leads.service`) for an unrelated project —
  it auto-respawns within ~1s of being killed. The first two test runs
  silently hit that other Next.js app (its `/login` 404'd, its
  `/api/hello-tony/quotes` 404'd, its landing page had no "Paste data" hero)
  because Playwright's readiness check just waits for *any* HTTP response.
  Switched `E2E_PORT` to **3411** (confirmed free, no supervisor) and
  documented why in `e2e/testEnv.ts`. This is a documented, deliberate
  deviation — the spec's port number wasn't load-bearing, "a dedicated port"
  was.
- Data-testid attributes added (small, additive edits to Task 12
  components): `LiveQuoteWidget` (`live-quote-widget`, `live-quote-text`),
  `NewApiPage` (`api-name-input`, `api-slug-input`, `table-paste-textarea`,
  `create-api-submit`), `CreateSuccessPanel` (`create-success-panel`,
  `endpoint-list`/`endpoint-random`/etc.), `ApiCard`
  (`api-card-${slug}`, nested `record-count`/`request-count`).

### Specs (`apps/web/e2e/`)

- `landing.spec.ts`: `/` → 200, hero heading + "Start building" link visible,
  `live-quote-widget` renders a non-empty `live-quote-text` (waits up to 15s
  for the client-side fetch to resolve).
- `public-api.spec.ts`: list envelope (`data`/`meta`, non-empty), `/random`,
  `?year_gt=1980` (every row's `year > 1980`), `?q=impossible` (matches the
  Mandela + Tony Robbins quotes, asserts every returned row actually
  contains the term), `/openapi.json` (has `openapi`, `paths["/quotes"]`,
  `paths["/quotes/random"]`, `paths["/quotes/{id}"]`).
- `create-flow.spec.ts`: logs in via the real `/login` form
  (`e2e/helpers.ts#loginAsAdmin`), goes to `/admin/new`, pastes a 2-row TSV
  (title/author/year) under a unique slug, submits, asserts the success
  panel + `/api/<slug>/items` endpoint text, then fetches that endpoint and
  asserts the two pasted rows (title, author, year) came back correctly.
- `admin.spec.ts`: logs in, asserts the `hello-tony` card is visible with
  name, `/api/hello-tony` path, and an exact record count of **22** (waits
  for `StatCounter`'s count-up animation to settle) plus a numeric request
  count.

### Chromium install

`pnpm --filter web exec playwright install chromium` — browser was already
cached (`~/.cache/ms-playwright/chromium-1228`, installed 2026-07-01) and a
direct headless launch+navigate sanity check succeeded.
`playwright install --with-deps chromium` failed (`sudo: a terminal is
required...` — no passwordless sudo in this sandbox) but this only installs
OS-level shared libraries; **the browser itself launches and renders fine
headless**, confirmed independently before writing any test, so this is not
a real blocker for running the suite.

## Final Playwright run (green)

```
$ pnpm --filter web exec playwright test
[e2e:globalSetup] hello-tony ready (apiId=1, inserted=22) at file:/home/carmelo/Projects/NextJS/fancy/data/e2e.db

Running 8 tests using 6 workers

  ✓  4 [chromium] › e2e/public-api.spec.ts:17:7 › public read API (hello-tony/quotes) › random returns a single quote (143ms)
  ✓  5 [chromium] › e2e/public-api.spec.ts:27:7 › public read API (hello-tony/quotes) › filters with year_gt return only matching rows (199ms)
  ✓  7 [chromium] › e2e/public-api.spec.ts:38:7 › public read API (hello-tony/quotes) › free-text search (q) returns only matching rows (44ms)
  ✓  6 [chromium] › e2e/public-api.spec.ts:4:7 › public read API (hello-tony/quotes) › lists quotes with a data/meta envelope (167ms)
  ✓  8 [chromium] › e2e/public-api.spec.ts:53:7 › public read API (hello-tony/quotes) › openapi.json is valid JSON with paths for the quotes collection (27ms)
  ✓  3 [chromium] › e2e/landing.spec.ts:4:7 › landing page › loads with hero and a live quote (471ms)
  ✓  1 [chromium] › e2e/create-flow.spec.ts:5:7 › create API by pasting a table › paste table -> create -> read the pasted rows back (1.8s)
  ✓  2 [chromium] › e2e/admin.spec.ts:5:7 › admin dashboard › shows the hello-tony card with record/request counts (1.9s)

  8 passed (22.3s)
```

Re-run twice more (once via `pnpm e2e`, once directly) from a fully cold
state (no existing server on the port — genuine `next build && next start`
each time, not a reused server) — both 8/8 green, same timing envelope.
`data/app.db` (dev DB) checksum verified unchanged before/after the whole
E2E run — the dedicated `data/e2e.db` never touches it.

`pnpm test` (unit): 69/69 green. `pnpm typecheck`: clean (`packages/core` +
`apps/web`, including all new `e2e/*.ts` files). `pnpm build`: green.

## Sandbox blockers

1. `playwright install --with-deps chromium` can't sudo in this sandbox
   (no-op for correctness — Chromium already launches headless fine without
   it; documented above).
2. Port 3100 (the spec's example port) is unusable on this specific dev
   machine because of an unrelated BigBucket-supervised service permanently
   bound to it; worked around by using port 3411 for the E2E `webServer`
   instead. No code/config elsewhere hardcodes 3100, so this has no impact
   outside this repo's `apps/web/e2e/testEnv.ts`.

No other blockers. Both parts fully verified end-to-end, not just "should work."
