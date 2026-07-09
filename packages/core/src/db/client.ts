import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Open a libsql client + drizzle instance for either storage mode:
 *
 *  - **Local file** (`file:` / `:memory:`) — the default; native libsql.
 *  - **Remote** (`libsql://`, `http(s)://`, `ws(s)://`) — a self-hosted `sqld`
 *    or Turso database, authenticated with `authToken`. The libsql client
 *    speaks the remote hrana protocol (no native binding involved on the
 *    query path), so this works on serverless/ephemeral-FS hosts like Vercel.
 *
 * The one `@libsql/client` handles both — verified against a live `sqld` over
 * HTTP — so there's no URL-scheme branching and, importantly, no
 * `@libsql/client/web` subpath (whose file the Next standalone tracer drops,
 * which crash-loops the Docker image). `authToken` is ignored for file URLs.
 * Nothing downstream (query builder, repo, MCP, ingest) knows which mode is active.
 */
export function getDb(url?: string, authToken?: string) {
  const dbUrl = url ?? "file:./data/app.db";
  const client = createClient({
    url: dbUrl === ":memory:" ? ":memory:" : dbUrl,
    ...(authToken ? { authToken } : {}),
  });
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
