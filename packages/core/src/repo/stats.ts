import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { requestLog } from "../db/schema";
import { listCollections } from "./apis";
import { listRecords } from "./records";

export interface CollectionStats {
  slug: string;
  name: string;
  totalRecords: number;
}

export interface RequestsByDay {
  /** YYYY-MM-DD (UTC) */
  date: string;
  count: number;
}

export interface ApiStats {
  totalRecords: number;
  totalRequests: number;
  requestsByDay: RequestsByDay[];
  byCollection: CollectionStats[];
}

/**
 * Aggregates the counters the admin UI needs for one api: total records
 * (summed across its collections), total requests served, a per-day request
 * histogram, and a per-collection record breakdown. Read-only, cheap enough
 * to run per page load for a self-hosted, single-operator instance.
 */
export async function getApiStats(db: Db, apiId: number): Promise<ApiStats> {
  const collections = await listCollections(db, apiId);

  const byCollection: CollectionStats[] = [];
  let totalRecords = 0;
  for (const collection of collections) {
    // limit: 0 skips fetching row data — `listRecords` still computes `total`
    // via a separate count query regardless of limit/offset.
    const { total } = await listRecords(db, collection.id, { limit: 0 });
    totalRecords += total;
    byCollection.push({ slug: collection.slug, name: collection.name, totalRecords: total });
  }

  const logs = await db
    .select({ ts: requestLog.ts })
    .from(requestLog)
    .where(eq(requestLog.apiId, apiId));

  const dayBuckets = new Map<string, number>();
  for (const { ts } of logs) {
    const date = new Date(ts).toISOString().slice(0, 10);
    dayBuckets.set(date, (dayBuckets.get(date) ?? 0) + 1);
  }
  const requestsByDay = Array.from(dayBuckets.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalRecords, totalRequests: logs.length, requestsByDay, byCollection };
}
