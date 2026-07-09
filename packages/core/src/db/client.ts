import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function getDb(url?: string) {
  const dbUrl = url ?? "file:./data/app.db";
  const client = createClient({ url: dbUrl === ":memory:" ? ":memory:" : dbUrl });
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
