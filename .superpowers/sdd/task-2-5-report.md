# Tasks 2-5 Report — Core Engine (DB schema, type inference, parsing, query builder)

Plan: `docs/superpowers/plans/2026-07-08-declarative-api-platform.md`
Scope: `packages/core/src` only (TDD: tests first, then implementation).

## Files created

### Piece A — DB schema & client
- `packages/core/src/db/schema.ts` — Drizzle `sqlite-core` tables: `apis`,
  `collections` (unique index on `(apiId, slug)` via `uniqueIndex`),
  `records`, `requestLog`.
- `packages/core/src/db/client.ts` — `getDb(url?)` (wraps
  `@libsql/client` `createClient` + `drizzle-orm/libsql`; `':memory:'` passed
  through as-is, otherwise defaults to `file:./data/app.db`), `ensureSchema(db)`
  (raw `CREATE TABLE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` DDL
  run sequentially via `db.$client.execute`), `Db` type.
- `packages/core/src/db/db.test.ts` — 1 test: bootstrap `:memory:` db,
  `ensureSchema`, insert + select an `apis` row, assert slug/name/default
  `config` round-trip.

### Piece B — type inference
- `packages/core/src/ingest/infer.ts` — `ColumnType`, `ColumnSchema`,
  `inferColumns(rows)` (union of keys; per-column: all-numeric → `number`,
  else all in `{true,false,yes,no}` case-insensitive → `boolean`, else all
  match `YYYY-MM-DD`(+optional time/offset) → `date`, else `string`; empty
  column → `string`), `coerceRow(row, schema)` (typed conversion; empty/missing
  → `null`).
- `packages/core/src/ingest/infer.test.ts` — 9 tests covering each type,
  mixed→string fallback, empty column, key-union inference, and
  `coerceRow` producing real `number`/`boolean` JS values plus null handling.

### Piece C — parsing
- `packages/core/src/ingest/parse.ts` — `parseTable(text)` (papaparse,
  `header: true`, `skipEmptyLines: true`, `delimitersToGuess: [',','\t',';','|']`,
  trims header/cell values), `parseCsv(text)` (comma-forced variant).
- `packages/core/src/ingest/parse.test.ts` — 5 tests: CSV w/ header, TSV
  paste, quoted field containing a comma (both functions).

### Piece D — query builder
- `packages/core/src/query/params.ts` — `Op`, `Filter`, `QuerySpec`,
  `parseQuery(params, schema)`: reserved `sort`/`limit`/`offset`/`q`;
  `field` → `eq`; `field_gt|gte|lt|lte|ne|contains|in` → that op (`_in` split
  on comma into an array); filter values coerced to the column's type from
  `schema`; params whose field isn't in `schema` are silently ignored;
  `limit` defaults to 25, capped at 100; `sort` entries not in `schema` are
  dropped.
- `packages/core/src/query/build.ts` — `runQuery(db, collectionId, spec, schema)`,
  `getById(db, collectionId, id)`, `randomRecord(db, collectionId)`. All
  built on the raw libsql client (`db.$client.execute`) against
  `json_extract(data, '$.' || ?)`, with the field name itself passed as a
  bound parameter (never string-interpolated) and all filter/`q` values also
  bound. `contains` → `LIKE %v%`, `in` → `IN (...)`, `q` → OR of `LIKE`
  across every `string`-typed column in `schema`. Booleans are coerced to
  `1`/`0` for comparison (SQLite JSON booleans surface as 0/1 integers via
  `json_extract`). Sort defaults to `seq ASC` when no `sort` is given, else
  one `ORDER BY json_extract(...) ASC|DESC` expression per sort field.
  `total` is a separate `COUNT(*)` query sharing the same `WHERE`, unaffected
  by `LIMIT`/`OFFSET`. Rows are returned as `{ id, ...JSON.parse(data) }`.
- `packages/core/src/query/query.test.ts` — 11 tests. Seeds one `apis` row,
  one `collections` row (id `1`, matching schema JSON), and 6 quote `records`
  (`author` string, `text` string, `year` number — inserts hit the `records`
  FK on `collections.id`, which the local libsql sqlite3 driver enforces by
  default, so both parent rows are required). Covers: `eq` filter, `gt`
  filter with numeric coercion, `contains` filter, `sort=-year` descending
  order, `limit`/`offset` pagination against a deterministic `sort=author`,
  default/max `limit` clamping, `q` free-text search, unknown-field params
  ignored, `getById` (hit + miss), `randomRecord`.

### `packages/core/src/index.ts`
Final export surface (barrel):
```ts
export const version = "0.1.0";

export * from "./db/schema";      // apis, collections, records, requestLog
export * from "./db/client";      // getDb, ensureSchema, Db
export * from "./ingest/infer";   // ColumnType, ColumnSchema, inferColumns, coerceRow
export * from "./ingest/parse";   // parseTable, parseCsv
export * from "./query/params";   // Op, Filter, QuerySpec, parseQuery
export * from "./query/build";    // runQuery, getById, randomRecord
```

## Test counts
- `packages/core/src/db/db.test.ts` — 1 test
- `packages/core/src/ingest/infer.test.ts` — 9 tests
- `packages/core/src/ingest/parse.test.ts` — 5 tests
- `packages/core/src/query/query.test.ts` — 11 tests
- Pre-existing `packages/core/src/index.test.ts` — 1 test
- **Total: 27 tests, 5 test files, all passing** (`pnpm test` via root
  `vitest run`).

`pnpm -r typecheck` — both `packages/core` and `apps/web` pass with no
errors.

## Commits (range `03a543f..90b3d86`, on top of `334a546`)
- `03a543f` — Task 2: DB schema & libsql/drizzle client
- `f84f281` — Task 3: column type inference (infer.ts)
- `81fa48f` — Task 4: CSV/TSV parsing (parse.ts)
- `90b3d86` — Task 5: query param parsing + parameterized query builder

Each commit's `pnpm test` + (for the final commit) `pnpm -r typecheck` were
green before committing; `index.ts` exports were added incrementally in step
with each piece so every commit is independently buildable/testable.

## Deviations / notes
- **FK enforcement in tests**: the local libsql sqlite3 driver enforces
  `FOREIGN KEY` constraints by default (unlike some SQLite setups where it's
  opt-in). `query.test.ts` therefore seeds a real `apis` row and `collections`
  row before inserting `records`, rather than using an arbitrary
  `collectionId` with no parent row.
- **Boolean SQL comparison**: SQLite has no native boolean type; JSON `true`/
  `false` values surface through `json_extract` as integers `1`/`0`. Filter
  values of JS type `boolean` are converted to `1`/`0` in `toSqlValue()`
  before binding, so `eq`/`ne`/etc. on boolean columns compare correctly.
- **`date` type comparisons**: dates are stored/compared as their original
  ISO-8601 strings (no separate epoch column), which sort/compare correctly
  as text for `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM:SS` forms — no additional
  coercion was added for `gt`/`lt` on date columns beyond passing the trimmed
  string through.
- **`runQuery` signature**: the task text mentions changing the signature to
  accept `schema` as a fourth argument for the `q` OR-across-string-columns
  behavior; implemented exactly as `runQuery(db, collectionId, spec, schema)`
  from the start (no separate 3-arg version was ever committed).
- No other deviations from the specified type/signature contracts.
