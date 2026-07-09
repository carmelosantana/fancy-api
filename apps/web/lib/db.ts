import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDb, ensureSchema, type Db } from "@app/core";

/**
 * Module-singleton database connection + one-time schema bootstrap.
 *
 * `getDb` is cheap (just opens a libsql client), but `ensureSchema` runs a
 * handful of `CREATE TABLE IF NOT EXISTS` statements — safe to re-run, but
 * pointless to repeat on every request, so we memoize the promise.
 */

function resolveDbUrl(): string {
  return process.env.DATABASE_PATH ? `file:${process.env.DATABASE_PATH}` : "file:./data/app.db";
}

function ensureParentDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path === ":memory:" || path === "") return;
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

let instance: Db | null = null;
let ready: Promise<void> | null = null;

export async function db(): Promise<Db> {
  if (!instance) {
    const url = resolveDbUrl();
    ensureParentDir(url);
    instance = getDb(url);
  }
  if (!ready) {
    ready = ensureSchema(instance);
  }
  await ready;
  return instance;
}
