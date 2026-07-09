# Task 6-8 Report: Core engine extensions (auth, repo, ingest pipeline, spec, MCP tools)

Branch: `master`. All work confined to `packages/core/src`. TDD with Vitest; each
piece committed independently.

Commit range: `c38215a..b489df0`

```
c38215a Task 6: token auth util (generate/hash/verify)
a466f73 Task 6: repository layer (apis, collections, records CRUD)
2b90d40 Task 6: ingest pipeline (get-or-create api/collection, infer, coerce, insert)
9470eb6 Task 6: declarative spec import/export/serialize (yaml+zod)
b489df0 Task 6: MCP tool handlers (framework-agnostic, token-gated writes)
```

Final state: `pnpm test` -> 10 test files, 65 tests, all passing.
`pnpm -r typecheck` -> clean for both `packages/core` and `apps/web`.

## Piece A — `src/auth/token.ts`

- `generateToken(): string` — `crypto.randomBytes(24).toString("base64url")`,
  yields exactly 32 base64url characters.
- `hashToken(token: string): string` — SHA-256 hex digest.
- `verifyToken(token: string, hash: string): boolean` — recomputes the hash
  and compares with `crypto.timingSafeEqual` (constant-time); returns `false`
  instead of throwing if the buffer lengths differ (malformed hash).

Test file: `src/auth/token.test.ts` (5 tests) — format, uniqueness,
round-trip, wrong-token rejection, hash determinism.

## Piece B — `src/repo/apis.ts`, `src/repo/records.ts`

`ApiRow` / `CollectionRow` types with `config` / `schema` parsed from their
stored JSON-text columns into real objects on every read.

`apis.ts`:
- `createApi`, `getApiBySlug`, `listApis`, `updateApi` (partial patch,
  bumps `updatedAt`), `deleteApi` (cascades: deletes all `records` for the
  api's collections, then the `collections`, then the `apis` row).
- `createCollection`, `getCollection`, `listCollections`,
  `setCollectionSchema`.

`records.ts`:
- `insertRecords(db, collectionId, rows)` — looks up
  `max(seq)` for the collection (via `ORDER BY seq DESC LIMIT 1`) and
  assigns sequential `seq` values continuing from there; JSON-stringifies
  each row; returns inserted count. No-ops (`0`) on an empty array.
- `updateRecord(db, collectionId, id, patch)` — shallow merge via
  `{ ...existing, ...patch }`, returns `{ id, ...merged }` or `null` if the
  record doesn't exist in that collection.
- `deleteRecord` — returns `true`/`false` based on `rowsAffected`.
- `listRecords(db, collectionId, { limit?, offset? })` — returns
  `{ data, total }`, ordered by `seq ASC`, with `id` injected into each row.

Test file: `src/repo/repo.test.ts` (15 tests) — CRUD round-trips for both
apis and collections, cascade delete, seq continuation across multiple
`insertRecords` calls, pagination + total count, merge semantics, not-found
cases for update/delete.

## Piece C — `src/ingest/pipeline.ts`

`ingest(db, { apiSlug, apiName?, description?, collectionSlug?,
collectionName?, rows }): Promise<{ apiId, collectionId, inserted, schema }>`

- Get-or-create the api by slug; name defaults to a title-cased version of
  the slug (`my-api` -> `My Api`) when creating.
- Infers a `ColumnSchema[]` from the raw string rows via `inferColumns`.
- Get-or-create the collection (default slug `items`, default name
  title-cased); on reuse, re-syncs the collection's stored schema to the
  newly inferred one via `setCollectionSchema` (handles rows with new/wider
  columns arriving in a later ingest call).
- Coerces every row with `coerceRow` against the (possibly re-synced) schema
  and bulk-inserts via `insertRecords`.

This single function is meant to back all four ingestion front doors (paste
table, CSV upload, paste CSV, imported file) — they only need to produce
`Record<string,string>[]` rows and call `ingest`.

Test file: `src/ingest/pipeline.test.ts` (2 tests) — ingesting 4 quote rows
(author/text/year) then verifying via `getCollection` + `runQuery` that
`year` round-trips as a number and sorts correctly; a second test verifies
default naming/slugging and that a second `ingest` call against the same
api/collection slugs reuses them and appends records.

## Piece D — `src/spec/{types,export,import,serialize}.ts`

- `types.ts`: `CollectionSpec { slug, name, schema, records }`,
  `ApiSpec { slug, name, description?, config?, collections }`.
- `export.ts`: `exportApi(db, apiSlug): Promise<ApiSpec>` — assembles the api
  plus every collection's schema and record data. Internal `id`s are
  stripped from each record (`{ id: _id, ...rest }`), and `ApiSpec` never
  carries `readKey`/`writeTokenHash` (the type doesn't have fields for them
  and export never reads those columns into the spec).
- `import.ts`: `importApi(db, spec, { overwrite? }): Promise<{ apiId }>` —
  creates the api + collections + records. If the slug already exists:
  throws unless `overwrite: true`, in which case it calls `deleteApi` first
  (cascading cleanup) before recreating.
- `serialize.ts`: `serializeSpec(spec, format: 'yaml'|'json' = 'yaml')` using
  the `yaml` package's `stringify` (or `JSON.stringify` for `'json'`);
  `parseSpec(text): ApiSpec` parses with `yaml.parse` (a superset of JSON)
  and validates the result against a Zod schema
  (`z.object({ slug, name, description?, config?, collections: [...] })`),
  throwing a descriptive `Error` on either a YAML syntax error or a shape
  mismatch.

Test file: `src/spec/spec.test.ts` (5 tests) — full round-trip
(ingest into db A -> `exportApi` -> `serializeSpec('yaml')` -> `parseSpec`
-> `importApi` into a fresh `:memory:` db B -> `runQuery` on B matches A,
records compared with ids stripped since autoincrement ids differ across
dbs); `overwrite: true` replaces an existing api; import without overwrite
throws on a slug collision; `parseSpec` rejects several garbage inputs
(malformed YAML, a bare string, `{}`, an object missing required fields);
JSON serialization format round-trips too.

## Piece E — `src/mcp/tools.ts`

- `assertWriteToken(api: ApiRow, token?: string): void` — no-op if the api
  has no `writeTokenHash`; otherwise throws unless the token verifies via
  `verifyToken`.
- Pure handlers (`(db, args) => Promise<...>`, no token checks):
  `listRecords`, `getRecord`, `queryRecords`, `insertRecord`,
  `insertRecords`, `updateRecord`, `deleteRecord`. Each resolves the api by
  slug and the collection by slug via the repo layer, throwing `Error` on
  either not being found (and on record-not-found for get/update/delete).
  `queryRecords` builds a `URLSearchParams` from a plain
  `Record<string,string>` query object and delegates to
  `parseQuery` + `runQuery`. `insertRecord` re-reads the just-inserted row
  (by total count / offset, since `insertRecords` only returns a count) so
  callers get the new record back with its id.
- `getToolDefinitions(): ToolDefinition[]` — one entry per tool
  (`list_records`, `get_record`, `query_records`, `insert_record`,
  `insert_records`, `update_record`, `delete_record`) with a Zod
  `inputSchema` and a `handler(db, args, ctx: { token? })`. The three
  read tools call the pure handler directly (no token check). The four
  write tools first resolve the api by slug and call `assertWriteToken`
  with `ctx.token` before delegating. This array is what the Next.js
  `/api/mcp` route is expected to register with the MCP SDK.

Test file: `src/mcp/mcp.test.ts` (11 tests) — `assertWriteToken` unit tests
(no-token-required api, missing token, wrong vs. correct token); an api
created with a `writeTokenHash` verifies `insert_record` succeeds with the
correct token and the record becomes queryable via `list_records`;
`insert_record` throws with a wrong or absent token; `list_records` (a read
tool) works with no token even though the api has one configured;
`get_record` throws for a missing id; `query_records` filters via a
`year_gt` query param; `update_record`/`delete_record` both require the
token and succeed once supplied; a schema sanity check confirms all 7 tool
definitions expose a `name`, `description`, and a parseable Zod
`inputSchema`.

## Full exported public surface (`packages/core/src/index.ts`)

Pre-existing (unchanged): `version`, everything from `db/schema`,
`db/client`, `ingest/infer`, `ingest/parse`, `query/params`, `query/build`.

Newly added:

```
export * from "./auth/token";        // generateToken, hashToken, verifyToken
export * from "./repo/apis";         // ApiRow, CollectionRow, createApi, getApiBySlug,
                                      // listApis, updateApi, deleteApi, createCollection,
                                      // getCollection, listCollections, setCollectionSchema,
                                      // CreateApiInput, UpdateApiPatch, CreateCollectionInput
export * from "./repo/records";      // insertRecords, updateRecord, deleteRecord, listRecords,
                                      // ListRecordsOpts
export * from "./ingest/pipeline";   // ingest, IngestInput, IngestResult
export * from "./spec/types";        // CollectionSpec, ApiSpec
export * from "./spec/export";       // exportApi
export * from "./spec/import";       // importApi, ImportApiOptions, ImportApiResult
export * from "./spec/serialize";    // serializeSpec, parseSpec, SerializeFormat

// mcp/tools.ts exported explicitly, not via `export *` — see deviation note below.
export {
  assertWriteToken,
  getToolDefinitions,
  getRecord,
  queryRecords,
  insertRecord,
  type ToolContext,
  type ToolDefinition,
  type ListRecordsArgs,
  type GetRecordArgs,
  type QueryRecordsArgs,
  type InsertRecordArgs,
  type InsertRecordsArgs,
  type UpdateRecordArgs,
  type DeleteRecordArgs,
} from "./mcp/tools";
export * as mcpTools from "./mcp/tools";  // full handler set, incl. names below
```

`mcpTools.listRecords`, `mcpTools.insertRecords`, `mcpTools.updateRecord`,
`mcpTools.deleteRecord` are reachable via the namespace (see deviation).

## Deviations from the brief

1. **`mcp/tools.ts` barrel export is not a plain `export *`.** Piece E's
   pure handlers are named `listRecords`, `insertRecords`, `updateRecord`,
   `deleteRecord` — identical to four functions already exported from
   `repo/records.ts` (different signatures: repo functions take
   `(db, collectionId, ...)`, MCP handlers take `(db, { apiSlug, collection,
   ... })`). Per the ES module spec, `export * from` on two modules with a
   colliding name **silently drops that name entirely** from the barrel
   (not an error) — which would have broken the pre-existing, already-tested
   `repo/records.ts` exports (`insertRecords`, `updateRecord`,
   `deleteRecord`, `listRecords`) without any compile error to catch it. I
   kept every internal function name as specified (so `mcp/tools.ts` itself,
   and the tests in `mcp.test.ts`, are exactly as briefed), but changed how
   `index.ts` re-exports it: explicit named exports for the
   non-colliding public surface (`assertWriteToken`, `getToolDefinitions`,
   `getRecord`, `queryRecords`, `insertRecord`, plus the `*Args`/`Context`/
   `Definition` types) and `export * as mcpTools from "./mcp/tools"` for
   full access to everything, including the colliding names, without
   breaking `repo/records.ts`'s exports. `getToolDefinitions()` is the
   primary surface the Next.js `/api/mcp` route needs and is exported
   directly at the top level.
2. **`insertRecord` does an extra read after insert.** `repo/records.ts`'s
   `insertRecords` only returns an inserted count (no ids), so the MCP
   `insertRecord` handler re-queries (`listRecords` for `total`, then for
   the record at `offset total - 1`) to hand the caller back the created
   row with its id. This assumes no concurrent writer races between the
   insert and the follow-up read within the same handler invocation — true
   for the current single-process/libsql-in-process usage but worth
   revisiting if concurrent writers are introduced later.
3. Piece D's task text said file path `src/spec/serialize.ts` in the file
   list but then referred to it as `serialize/serialize.ts` inline; treated
   as the same file, `src/spec/serialize.ts` (all four spec files live
   flat under `src/spec/`).

## Files touched

- `packages/core/src/auth/token.ts`, `packages/core/src/auth/token.test.ts`
- `packages/core/src/repo/apis.ts`, `packages/core/src/repo/records.ts`,
  `packages/core/src/repo/repo.test.ts`
- `packages/core/src/ingest/pipeline.ts`,
  `packages/core/src/ingest/pipeline.test.ts`
- `packages/core/src/spec/types.ts`, `packages/core/src/spec/export.ts`,
  `packages/core/src/spec/import.ts`, `packages/core/src/spec/serialize.ts`,
  `packages/core/src/spec/spec.test.ts`
- `packages/core/src/mcp/tools.ts`, `packages/core/src/mcp/mcp.test.ts`
- `packages/core/src/index.ts` (barrel updated after every piece)

## Test count summary

| File | Tests |
|---|---|
| `src/auth/token.test.ts` | 5 |
| `src/repo/repo.test.ts` | 15 |
| `src/ingest/pipeline.test.ts` | 2 |
| `src/spec/spec.test.ts` | 5 |
| `src/mcp/mcp.test.ts` | 11 |
| pre-existing (db/index/ingest-infer/ingest-parse/query) | 27 |
| **Total** | **65**, 10 files, all green |

`pnpm -r typecheck` clean for `packages/core` and `apps/web`.
