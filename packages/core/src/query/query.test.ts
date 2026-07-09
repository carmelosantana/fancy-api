import { beforeAll, describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import { apis, collections, records } from "../db/schema";
import type { ColumnSchema } from "../ingest/infer";
import { parseQuery } from "./params";
import { runQuery, getById, randomRecord } from "./build";

const COLLECTION_ID = 1;

const schema: ColumnSchema[] = [
  { name: "author", type: "string" },
  { name: "text", type: "string" },
  { name: "year", type: "number" },
];

const quotes = [
  { author: "Ada Lovelace", text: "The Analytical Engine has no pretensions", year: 1843 },
  { author: "Ada Lovelace", text: "That brain of mine is more than merely mortal", year: 1841 },
  { author: "Alan Turing", text: "Sometimes it is the people no one imagines anything of", year: 1950 },
  { author: "Alan Turing", text: "We can only see a short distance ahead", year: 1950 },
  { author: "Grace Hopper", text: "A ship in port is safe", year: 1980 },
  {
    author: "Grace Hopper",
    text: "The most dangerous phrase in the language is we have always done it this way",
    year: 1976,
  },
];

let db: Db;
let ids: number[] = [];

beforeAll(async () => {
  db = getDb(":memory:");
  await ensureSchema(db);

  const now = Date.now();

  const api = await db.insert(apis).values({
    slug: "quotes-api",
    name: "Quotes API",
    createdAt: now,
    updatedAt: now,
  });
  const apiId = Number(api.lastInsertRowid);

  const collection = await db.insert(collections).values({
    apiId,
    slug: "quotes",
    name: "Quotes",
    schema: JSON.stringify(schema),
    createdAt: now,
    updatedAt: now,
  });
  expect(Number(collection.lastInsertRowid)).toBe(COLLECTION_ID);

  ids = [];
  for (const [i, quote] of quotes.entries()) {
    const result = await db.insert(records).values({
      collectionId: COLLECTION_ID,
      data: JSON.stringify(quote),
      seq: i,
      createdAt: now,
      updatedAt: now,
    });
    ids.push(Number(result.lastInsertRowid));
  }
});

describe("parseQuery + runQuery", () => {
  test("eq filter matches by exact field value", async () => {
    const spec = parseQuery(new URLSearchParams("author=Ada+Lovelace"), schema);
    const { data, total } = await runQuery(db, COLLECTION_ID, spec, schema);
    expect(total).toBe(2);
    expect(data.every((r) => r.author === "Ada Lovelace")).toBe(true);
  });

  test("gt filter coerces numeric threshold", async () => {
    const spec = parseQuery(new URLSearchParams("year_gt=1900"), schema);
    const { data, total } = await runQuery(db, COLLECTION_ID, spec, schema);
    expect(total).toBe(4);
    expect(data.every((r) => (r.year as number) > 1900)).toBe(true);
  });

  test("contains filter matches substring", async () => {
    const spec = parseQuery(new URLSearchParams("text_contains=dangerous"), schema);
    const { data, total } = await runQuery(db, COLLECTION_ID, spec, schema);
    expect(total).toBe(1);
    expect(data[0]?.author).toBe("Grace Hopper");
  });

  test("sort=-year orders descending", async () => {
    const spec = parseQuery(new URLSearchParams("sort=-year"), schema);
    const { data } = await runQuery(db, COLLECTION_ID, spec, schema);
    const years = data.map((r) => r.year as number);
    const sorted = [...years].sort((a, b) => b - a);
    expect(years).toEqual(sorted);
    expect(years[0]).toBe(1980);
  });

  test("limit/offset paginate a deterministic sort", async () => {
    const spec = parseQuery(new URLSearchParams("sort=author&limit=2&offset=2"), schema);
    const { data, total } = await runQuery(db, COLLECTION_ID, spec, schema);
    expect(total).toBe(6);
    expect(data).toHaveLength(2);
    expect(data.every((r) => r.author === "Alan Turing")).toBe(true);
  });

  test("default limit is 25 and max is capped at 100", () => {
    expect(parseQuery(new URLSearchParams(""), schema).limit).toBe(25);
    expect(parseQuery(new URLSearchParams("limit=500"), schema).limit).toBe(100);
  });

  test("q free-text search matches across string columns", async () => {
    const spec = parseQuery(new URLSearchParams("q=Analytical"), schema);
    const { data, total } = await runQuery(db, COLLECTION_ID, spec, schema);
    expect(total).toBe(1);
    expect(data[0]?.author).toBe("Ada Lovelace");
  });

  test("unknown fields are ignored", () => {
    const spec = parseQuery(new URLSearchParams("bogus=xyz"), schema);
    expect(spec.filters).toHaveLength(0);
  });
});

describe("getById / randomRecord", () => {
  test("getById returns the matching record with injected id", async () => {
    const targetId = ids[0] as number;
    const record = await getById(db, COLLECTION_ID, targetId);
    expect(record).not.toBeNull();
    expect(record?.id).toBe(targetId);
    expect(record?.author).toBe("Ada Lovelace");
  });

  test("getById returns null for a missing id", async () => {
    const record = await getById(db, COLLECTION_ID, 999999);
    expect(record).toBeNull();
  });

  test("randomRecord returns one of the seeded records", async () => {
    const record = await randomRecord(db, COLLECTION_ID);
    expect(record).not.toBeNull();
    expect(ids).toContain(record?.id);
  });
});
