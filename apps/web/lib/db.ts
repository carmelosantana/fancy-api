import { getDb, ensureSchema, ensureDbDir, resolveDbConfig, type Db } from "@app/core";

/**
 * Module-singleton database connection + one-time schema bootstrap.
 *
 * `getDb` is cheap (just opens a libsql client), but `ensureSchema` runs a
 * handful of `CREATE TABLE IF NOT EXISTS` statements — safe to re-run, but
 * pointless to repeat on every request, so we memoize the promise.
 *
 * The connection itself is resolved by `@app/core`'s `resolveDbConfig()`:
 * a **remote** libsql URL (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`) for
 * ephemeral-FS hosts like Vercel, or the existing **local file** path
 * (`DATABASE_PATH`, default `<repoRoot>/data/app.db`) for localhost/Docker.
 * `scripts/seed.ts` calls the exact same resolver, so both processes always
 * agree on which database they're touching. See `packages/core/src/paths.ts`.
 */

let instance: Db | null = null;
let ready: Promise<void> | null = null;

export async function db(): Promise<Db> {
  if (!instance) {
    const { url, authToken } = resolveDbConfig();
    ensureDbDir(url);
    instance = getDb(url, authToken);
  }
  if (!ready) {
    ready = ensureSchema(instance);
  }
  await ready;
  return instance;
}
