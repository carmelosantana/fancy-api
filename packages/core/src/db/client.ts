import { createClient as createNodeClient } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Matches a remote libsql/HTTP(S)/WebSocket URL — anything that isn't a local file. */
const REMOTE_URL_RE = /^(libsql|https?|wss?):\/\//;

/**
 * Open a libsql client + drizzle instance for either storage mode:
 *
 *  - **Remote** (`url` matches `libsql://`, `http(s)://`, `ws(s)://`) — a
 *    self-hosted `sqld` or Turso database. Uses `@libsql/client/web`, a
 *    pure-HTTP client with no native binary, so the bundle stays
 *    serverless-safe (Vercel's ephemeral FS can't hold a native binding
 *    anyway). `authToken` is passed through as-is.
 *  - **Local file** (`file:` / `:memory:`) — unchanged: the native
 *    `@libsql/client`, as today.
 *
 * Both branches return the same libsql `Client` shape, so `drizzle-orm/libsql`
 * works identically either way — nothing downstream (query builder, repo,
 * MCP, ingest) needs to know which mode is active.
 */
export function getDb(url?: string, authToken?: string) {
  const dbUrl = url ?? "file:./data/app.db";
  if (dbUrl !== ":memory:" && REMOTE_URL_RE.test(dbUrl)) {
    const client = createWebClient({ url: dbUrl, authToken });
    return drizzle(client, { schema });
  }
  const client = createNodeClient({ url: dbUrl === ":memory:" ? ":memory:" : dbUrl });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof getDb>;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS apis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    read_key TEXT,
    write_token_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL REFERENCES apis(id),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    schema TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS collections_api_id_slug_idx ON collections (api_id, slug)`,
  `CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id),
    data TEXT NOT NULL,
    seq INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER,
    ts INTEGER NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL
  )`,
];

export async function ensureSchema(db: Db): Promise<void> {
  const client = db.$client;
  for (const sql of DDL_STATEMENTS) {
    await client.execute(sql);
  }
}
