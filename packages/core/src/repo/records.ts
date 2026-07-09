import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { records } from "../db/schema";

function rowToRecord(row: { id: number; data: string }): Record<string, unknown> {
  const data = JSON.parse(row.data) as Record<string, unknown>;
  return { id: row.id, ...data };
}

async function nextSeq(db: Db, collectionId: number): Promise<number> {
  const rows = await db
    .select({ seq: records.seq })
    .from(records)
    .where(eq(records.collectionId, collectionId))
    .orderBy(desc(records.seq))
    .limit(1);
  const last = rows[0]?.seq;
  return last === undefined ? 0 : last + 1;
}

export async function insertRecords(
  db: Db,
  collectionId: number,
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const now = Date.now();
  let seq = await nextSeq(db, collectionId);

  const values = rows.map((row) => ({
    collectionId,
    data: JSON.stringify(row),
    seq: seq++,
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(records).values(values);
  return values.length;
}

export async function updateRecord(
  db: Db,
  collectionId: number,
  id: number,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.collectionId, collectionId), eq(records.id, id)));
  const existing = rows[0];
  if (!existing) return null;

  const merged = { ...(JSON.parse(existing.data) as Record<string, unknown>), ...patch };

  await db
    .update(records)
    .set({ data: JSON.stringify(merged), updatedAt: Date.now() })
    .where(and(eq(records.collectionId, collectionId), eq(records.id, id)));

  return { id, ...merged };
}

export async function deleteRecord(
  db: Db,
  collectionId: number,
  id: number,
): Promise<boolean> {
  const result = await db
    .delete(records)
    .where(and(eq(records.collectionId, collectionId), eq(records.id, id)));
  return (result.rowsAffected ?? 0) > 0;
}

export interface ListRecordsOpts {
  limit?: number;
  offset?: number;
}

export async function listRecords(
  db: Db,
  collectionId: number,
  opts: ListRecordsOpts = {},
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const countRows = await db
    .select({ id: records.id })
    .from(records)
    .where(eq(records.collectionId, collectionId));
  const total = countRows.length;

  let query = db
    .select()
    .from(records)
    .where(eq(records.collectionId, collectionId))
    .orderBy(asc(records.seq))
    .$dynamic();

  if (opts.limit !== undefined) query = query.limit(opts.limit);
  if (opts.offset !== undefined) query = query.offset(opts.offset);

  const rows = await query;
  return { data: rows.map(rowToRecord), total };
}
