import { getDb, ensureSchema, ensureDbDir, resolveDbUrl, type Db } from "@app/core";

/**
 * Module-singleton database connection + one-time schema bootstrap.
 *
 * `getDb` is cheap (just opens a libsql client), but `ensureSchema` runs a
 * handful of `CREATE TABLE IF NOT EXISTS` statements — safe to re-run, but
 * pointless to repeat on every request, so we memoize the promise.
 *
 * The DB path itself is resolved by `@app/core`'s `resolveDbUrl()` — an
 * absolute, repo-root-relative path (`<repoRoot>/data/app.db` by default, or
 * `DATABASE_PATH` if set) shared verbatim with `scripts/seed.ts`, so both
 * processes always agree on which sqlite file they're touching regardless of
 * their respective working directories. See `packages/core/src/paths.ts`.
 */

let instance: Db | null = null;
let ready: Promise<void> | null = null;

export async function db(): Promise<Db> {
  if (!instance) {
    const url = resolveDbUrl();
    ensureDbDir(url);
    instance = getDb(url);
  }
  if (!ready) {
    ready = ensureSchema(instance);
  }
  await ready;
  return instance;
}
