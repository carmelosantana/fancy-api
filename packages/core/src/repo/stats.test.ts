import { beforeEach, describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import type { ColumnSchema } from "../ingest/infer";
import { createApi, createCollection } from "./apis";
import { insertRecords } from "./records";
import { requestLog } from "../db/schema";
import { getApiStats } from "./stats";

const schema: ColumnSchema[] = [{ name: "title", type: "string" }];

let db: Db;

beforeEach(async () => {
  db = getDb(":memory:");
  await ensureSchema(db);
});

describe("getApiStats", () => {
  test("aggregates records across collections and requests by day", async () => {
    const api = await createApi(db, { slug: "quotes", name: "Quotes" });
    const quotes = await createCollection(db, { apiId: api.id, slug: "quotes", name: "Quotes", schema });
    const authors = await createCollection(db, { apiId: api.id, slug: "authors", name: "Authors", schema });

    await insertRecords(db, quotes.id, [{ title: "a" }, { title: "b" }, { title: "c" }]);
    await insertRecords(db, authors.id, [{ title: "x" }]);

    const day1 = Date.parse("2026-01-01T00:00:00Z");
    const day2 = Date.parse("2026-01-02T00:00:00Z");
    await db.insert(requestLog).values([
      { apiId: api.id, ts: day1, method: "GET", path: "/api/quotes/quotes", status: 200 },
      { apiId: api.id, ts: day1 + 1000, method: "GET", path: "/api/quotes/quotes", status: 200 },
      { apiId: api.id, ts: day2, method: "GET", path: "/api/quotes/authors", status: 404 },
    ]);

    const stats = await getApiStats(db, api.id);

    expect(stats.totalRecords).toBe(4);
    expect(stats.totalRequests).toBe(3);
    expect(stats.byCollection).toEqual(
      expect.arrayContaining([
        { slug: "quotes", name: "Quotes", totalRecords: 3 },
        { slug: "authors", name: "Authors", totalRecords: 1 },
      ]),
    );
    expect(stats.requestsByDay).toEqual([
      { date: "2026-01-01", count: 2 },
      { date: "2026-01-02", count: 1 },
    ]);
  });

  test("returns zeroed stats for an api with no collections or requests", async () => {
    const api = await createApi(db, { slug: "empty", name: "Empty" });
    const stats = await getApiStats(db, api.id);
    expect(stats).toEqual({ totalRecords: 0, totalRequests: 0, requestsByDay: [], byCollection: [] });
  });
});
