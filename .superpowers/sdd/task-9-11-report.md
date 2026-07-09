# Task 9-11 Report: Web backend — DB/auth, management API, public read API, MCP endpoint

Branch: `master`. All work confined to `apps/web` (plus two `apps/web/package.json`
dependency additions forced by a bundling issue — see Deviations). No engine
logic was reimplemented; every route is a thin adapter over `@app/core`.

Commit range: `fe68122..16b1bdd`

```
fe68122 Task 9: DB singleton + single-admin session auth (lib/db.ts, lib/auth.ts)
72e1466 Task 9: auth routes + middleware guarding /admin and /api/_manage
a2a4c21 Fix Task 9: escape _manage folder so /api/_manage/* routes actually route
83cdb86 Task 9: management API (create/list/delete apis, export, import, rotate-token)
2feacf5 Task 10: public read API (list/get/random + OpenAPI doc)
16b1bdd Task 11: MCP endpoint over Streamable HTTP (mcp-handler), scoped per api
```

## Files

**Lib**
- `apps/web/lib/db.ts` — module-singleton `Db` + one-time `ensureSchema`,
  memoized via a promise. `DATABASE_PATH` env → `file:<path>`, else
  `file:./data/app.db` (parent dir auto-created).
- `apps/web/lib/auth.ts` — single-admin session. `ADMIN_PASSWORD` env
  (default `"admin"`, warns once via `console.warn` if unset). Cookie
  `dap_session` = `hashToken(ADMIN_PASSWORD)`, httpOnly/sameSite=lax/path=/.
  Exports `sessionValue()`, `checkPassword()`, `isAuthed()`, `requireAdmin(req)`.
  Constant-time comparisons via `node:crypto.timingSafeEqual`. Imports
  `hashToken` from `@app/core/src/auth/token` directly (not the barrel) — see
  Deviations.
- `apps/web/lib/reserved.ts` — `RESERVED_API_SLUGS` (`_manage`, `mcp`),
  `RESERVED_COLLECTION_SLUGS` (`openapi.json`).
- `apps/web/lib/publicApi.ts` — shared plumbing for the public read routes:
  CORS headers/OPTIONS response, `checkReadKey`, `resolveApi`/`resolveCollection`,
  fire-and-forget `logRequest` (writes to the `requestLog` table exported by
  `@app/core`'s schema barrel; errors swallowed, never awaited by callers).

**Auth + admin shell**
- `apps/web/middleware.ts` — Node.js-runtime middleware (`runtime: "nodejs"`
  in `export const config`), matcher `["/admin/:path*", "/api/_manage/:path*"]`.
  Bypasses the check for `/api/_manage/login`; unauthed `/admin/*` →
  redirect to `/login`; unauthed `/api/_manage/*` → 401 JSON.
- `apps/web/app/api/_manage/login/route.ts` (on disk: `%5Fmanage/login`) — POST.
- `apps/web/app/api/_manage/logout/route.ts` (`%5Fmanage/logout`) — POST.
- `apps/web/app/login/page.tsx` — client-component form, fetch → `/admin`.
- `apps/web/app/admin/page.tsx` — server component, `listApis()`,
  `export const dynamic = "force-dynamic"` (must not be statically
  prerendered — see Deviations). Explicitly a placeholder; builder UI is Task 12.

**Management API** (all `requireAdmin`-gated; also covered by middleware)
- `POST /api/_manage/apis` — body `{ apiSlug, apiName?, description?,
  collectionSlug?, collectionName?, rows? | csvText? | tableText? }`.
  `rows` (JSON) is stringified per-cell before `ingest()` so JSON-rows and
  pasted-table rows get identical column-type inference. Reserved-slug
  checks on both `apiSlug` and `collectionSlug`. Mints + hashes a write
  token and returns it once, only when the api didn't already exist.
  Returns `{ apiSlug, collectionSlug, inserted, writeToken? }`.
- `GET /api/_manage/apis` — all apis with per-collection `{slug,name,schema}`
  summaries and `hasReadKey`/`hasWriteToken` booleans (no secrets in the body).
- `DELETE /api/_manage/apis/[slug]` — 404 if unknown, else `deleteApi`.
- `GET /api/_manage/apis/[slug]/export?format=yaml|json` — `exportApi` +
  `serializeSpec`, `Content-Disposition: attachment`.
- `POST /api/_manage/import` — raw spec text body (not JSON-wrapped) →
  `parseSpec` → `importApi(db, spec, { overwrite: true })`. Reserved-slug
  check on the spec's own slug.
- `POST /api/_manage/apis/[slug]/rotate-token` — new token, returned once.

**Public read API** (no auth; optional per-api read key; permissive CORS)
- `GET /api/[api]/[collection]` — `parseQuery` + `runQuery` →
  `{ data, meta: { total, limit, offset } }`.
- `GET /api/[api]/[collection]/[id]` — `getById` → `{ data }` or 404
  (non-integer `id` also 404s cleanly rather than hitting the DB).
- `GET /api/[api]/[collection]/random` — `randomRecord` → `{ data }` or 404
  if the collection is empty. Sibling static segment beats `[id]` by
  Next.js's static-before-dynamic route resolution.
- `GET /api/[api]/openapi.json` — hand-built OpenAPI 3.1 doc; one
  list/random/{id} path triple per collection, filter query params derived
  from `collection.schema` (`eq/ne/gt/gte/lt/lte/contains/in` per column,
  string columns skip the numeric comparison ops) plus `sort/limit/offset/q`.
- All four resolve api (404), then check `api.readKey || api.config.readKey`
  against `x-api-key` header or `?key=` (401 if required and wrong/missing),
  then resolve collection (404), then do the read; every branch writes a
  best-effort `request_log` row and sets `Access-Control-Allow-Origin: *`
  (each route also exports `OPTIONS` for the CORS preflight browsers send
  when `x-api-key` is used cross-origin).

**MCP endpoint**
- `apps/web/app/api/mcp/[api]/route.ts` — `POST` and `GET`, both delegating
  to one `handleMcpRequest`.

## MCP path taken: the library, not hand-rolled JSON-RPC

Used `mcp-handler`'s `createMcpHandler`. The one wrinkle: `mcp-handler` is
built around a *single, static* `[transport]` route (its README example is
`app/[transport]/route.ts`) whose `basePath` config derives a fixed
`streamableHttpEndpoint` (default `/mcp`) that the transport matches the
incoming `url.pathname` against internally. Our route is dynamic and
per-api (`/api/mcp/<slug>`), which doesn't fit that shape directly.

Fix: build the `createMcpHandler(...)` instance *inside* the request
handler (not at module scope) and pass `streamableHttpEndpoint: url.pathname`
— the exact incoming path — so the transport's internal
`url.pathname === streamableHttpEndpoint` check always matches. This also
conveniently lets `apiSlug` and the bearer/`x-write-token` be captured via
closure per request. Confirmed via the library's source
(`initializeMcpApiHandler` in `mcp-handler`'s `dist/index.js`) that
`initializeServer(server)` already runs fresh on every POST regardless
(`sessionIdGenerator` is left `undefined` → stateless), so building the
outer handler per-request adds no real overhead over the "normal" usage.

Each tool from `getToolDefinitions()` is registered via
`server.tool(def.name, def.description, def.inputSchema.shape, cb)`; the
callback calls `def.handler(db, { apiSlug, ...args }, { token })` and
converts thrown errors into `{ content: [...], isError: true }` rather than
letting them 500 the request (write-token checks throw plain `Error`s).

## Deviations / things I had to fix beyond the literal spec

1. **`_manage` is a Next.js "private folder" — routes silently vanished.**
   Next.js excludes any route segment whose folder name starts with `_`
   from the file-system router (it's the documented "private folder"
   convention). `app/api/_manage/**` therefore built *zero* routes — caught
   because the `next build` route table only listed `/`, `/admin`, `/login`
   with none of the `_manage` routes present. Fixed by renaming the folder
   to `app/api/%5Fmanage` (the documented `%5F` = URL-encoded-underscore
   escape), which keeps the literal `/api/_manage/...` URL while being
   routable again. Landed as its own fix commit (`a2a4c21`) since it
   corrected a bug in the piece 9 commit right before it.

2. **`@libsql/client`/`libsql` broke `next build` (webpack parse errors on
   README/LICENSE files).** `libsql`'s native-binding loader does a dynamic
   `require()` that webpack turns into a `require.context` glob, which then
   chokes trying to parse non-JS files (`README.md`, `LICENSE`) it sweeps
   up. `@libsql/client` and `libsql` are already in Next's *default*
   `serverExternalPackages` allowlist, so in principle this shouldn't
   bundle — but Next's externalization does a "would this resolve
   identically from the app root?" check (`handle-externals.js`,
   `baseResolveCheck`), and under pnpm's strict `node_modules` layout,
   `libsql` (a *transitive* dependency of `@libsql/client`, itself only a
   dependency of `packages/core`) isn't resolvable from `apps/web`'s own
   `node_modules` at all — so the check fails and Next falls back to
   bundling it, which then breaks. Fixed by adding `@libsql/client` and
   `libsql` as direct `apps/web` dependencies (harmless — real deps of code
   `apps/web` transitively runs) so pnpm creates the top-level symlinks the
   base-resolve check needs, plus explicit `serverExternalPackages` in
   `next.config.ts` for clarity/belt-and-suspenders.

3. **Edge-runtime middleware can't load `@libsql/client` either.**
   Separately, `lib/auth.ts` originally imported `hashToken` from the
   `@app/core` barrel (`export * from ...`), which — regardless of tree
   shaking — forces webpack to *parse* every barrel member during
   module-graph construction, including `db/client.ts` → `@libsql/client`.
   Since `lib/auth.ts` is pulled into `middleware.ts` (Edge/Node bundle,
   not the App Router server bundle where `serverExternalPackages`
   applies), that parse failure showed up there too. Fixed by importing
   `hashToken` from `@app/core/src/auth/token` directly (no `db.ts` in that
   file's own dependency chain), sidestepping the barrel entirely for this
   one crypto-only import.
4. **Middleware needs `node:crypto`.** Set `runtime: "nodejs"` in
   `middleware.ts`'s `export const config` (Next 15.5 supports Node.js
   middleware; confirmed via `next-server.js`'s `loadNodeMiddleware`).
   Default Edge runtime doesn't reliably support `node:crypto`'s
   `timingSafeEqual`/`createHash`.
5. **`apps/web/tsconfig.json` had no DOM lib** (base tsconfig is
   Node-only: `"lib": ["ES2022"]`). Client components (`app/login/page.tsx`)
   need `HTMLInputElement` etc., so added `"lib": ["ES2022", "DOM",
   "DOM.Iterable"]` to `apps/web/tsconfig.json`.
6. **`app/admin/page.tsx` was getting statically prerendered at build
   time** (`○ Static` in the build route table), which would freeze the
   API list as of the build and — worse — created a stray
   `apps/web/data/app.db` during `next build` from the build-time DB read.
   Added `export const dynamic = "force-dynamic"`; confirmed the route
   table now shows `ƒ /admin` and no `data/` directory appears after a
   clean build.

None of these touched `@app/core` — all fixes are Next.js/webpack/pnpm
plumbing in `apps/web`.

## Verify

`pnpm --filter web exec tsc --noEmit` — clean (ran after every piece; no
errors).

`pnpm --filter web build` — green, final route table:

```
Route (app)                                   Size  First Load JS
┌ ○ /                                        157 B         103 kB
├ ○ /_not-found                              993 B         104 kB
├ ƒ /admin                                   157 B         103 kB
├ ƒ /api/_manage/apis                          0 B            0 B
├ ƒ /api/_manage/apis/[slug]                   0 B            0 B
├ ƒ /api/_manage/apis/[slug]/export            0 B            0 B
├ ƒ /api/_manage/apis/[slug]/rotate-token      0 B            0 B
├ ƒ /api/_manage/import                        0 B            0 B
├ ƒ /api/_manage/login                         0 B            0 B
├ ƒ /api/_manage/logout                        0 B            0 B
├ ƒ /api/[api]/[collection]                  157 B         103 kB
├ ƒ /api/[api]/[collection]/[id]             157 B         103 kB
├ ƒ /api/[api]/[collection]/random           157 B         103 kB
├ ƒ /api/[api]/openapi.json                  157 B         103 kB
├ ƒ /api/mcp/[api]                           157 B         103 kB
└ ○ /login                                   807 B         103 kB
```

### curl smoke test (`next dev`, cookie jar, then killed)

Login (wrong password → 401; correct default password `admin` → 200 + cookie):
```
$ curl -i -c cookies.txt -X POST /api/_manage/login -d '{"password":"nope"}'
HTTP/1.1 401 Unauthorized

$ curl -i -c cookies.txt -X POST /api/_manage/login -d '{"password":"admin"}'
HTTP/1.1 200 OK
set-cookie: dap_session=8c6976e5...; Path=/; HttpOnly; SameSite=lax
{"ok":true}
```

Create api (unauthenticated → 401; authenticated → 200 + one-time token):
```
$ curl -i -X POST /api/_manage/apis -d '{"apiSlug":"hello-tony",...}'   # no cookie
HTTP/1.1 401 Unauthorized

$ curl -i -b cookies.txt -X POST /api/_manage/apis \
    -d '{"apiSlug":"hello-tony","apiName":"Hello Tony","collectionSlug":"quotes",
         "rows":[{"quote":"Fair enough","by":"Tony","rating":5},
                  {"quote":"Say less","by":"Tony","rating":4}]}'
HTTP/1.1 200 OK
{"apiSlug":"hello-tony","collectionSlug":"quotes","inserted":2,
 "writeToken":"m5A9FeGlp-3P_D5_GME1bMTa30CTST03"}
```

Public read routes:
```
$ curl -i /api/hello-tony/quotes
HTTP/1.1 200 OK
access-control-allow-origin: *
{"data":[{"id":1,"quote":"Fair enough","by":"Tony","rating":5},
         {"id":2,"quote":"Say less","by":"Tony","rating":4}],
 "meta":{"total":2,"limit":25,"offset":0}}

$ curl /api/hello-tony/quotes/random
{"data":{"id":2,"quote":"Say less","by":"Tony","rating":4}}

$ curl /api/hello-tony/quotes/1
{"data":{"id":1,"quote":"Fair enough","by":"Tony","rating":5}}

$ curl /api/hello-tony/openapi.json | head -c 300
{"openapi":"3.1.0","info":{"title":"Hello Tony","version":"1.0.0"},
 "servers":[{"url":"http://localhost:3000/api/hello-tony"}],
 "paths":{"/quotes":{"get":{"summary":"List Quotes", ... filter params ...

$ curl -i /api/nope/quotes
HTTP/1.1 404 Not Found
```

`GET /api/_manage/apis` (authed):
```
{"apis":[{"slug":"hello-tony","name":"Hello Tony","description":null,
  "hasReadKey":false,"hasWriteToken":true,"createdAt":...,"updatedAt":...,
  "collections":[{"slug":"quotes","name":"Quotes",
    "schema":[{"name":"quote","type":"string"},{"name":"by","type":"string"},
              {"name":"rating","type":"number"}]}]}]}
```

MCP (`POST /api/mcp/hello-tony`, `initialize`):
```
$ curl -i -X POST /api/mcp/hello-tony -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
         "params":{"protocolVersion":"2024-11-05","capabilities":{},
                    "clientInfo":{"name":"smoke-test","version":"0.1.0"}}}'
HTTP/1.1 200 OK
content-type: text/event-stream
event: message
data: {"result":{"protocolVersion":"2024-11-05",
  "capabilities":{"tools":{"listChanged":true}},
  "serverInfo":{"name":"dap-hello-tony","version":"0.1.0"}},"jsonrpc":"2.0","id":1}
```

Also exercised beyond the required smoke test (all passed):
- `tools/list` — returned all 8 tools with correct JSON-Schema-ified `zod` input schemas.
- `tools/call query_records` (no token) → the 2 seeded quotes.
- `tools/call insert_record` **without** `Authorization` → `isError: true`,
  `"Invalid or missing write token"`.
- `tools/call insert_record` **with** `Authorization: Bearer <writeToken>` → inserted row `{"id":3,...}`.
- `GET /api/_manage/apis/hello-tony/export?format=yaml` → downloadable YAML spec.
- `POST /api/_manage/apis/hello-tony/rotate-token` → new token.
- `POST /api/_manage/apis` with `apiSlug: "mcp"` → 400 (reserved slug).
- `DELETE /api/_manage/apis/hello-tony` → 200, cleaned up.

Dev server log checked for unexpected errors/warnings after the run: only
the expected one-per-bundle `ADMIN_PASSWORD not set, using default 'admin'`
warnings; nothing else. Server killed after the smoke test; no stray
`apps/web/data/` directory left behind (confirmed both after `next build`
and after `next dev`).

No route-level automated tests were added (optional per the task; the
engine already has 65 passing Vitest tests in `packages/core`, and the
curl smoke test above exercises every route end-to-end). Task 14
(Playwright E2E) is explicitly a later task in the plan.
