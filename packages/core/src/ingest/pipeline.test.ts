import { beforeEach, describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import { getApiBySlug, getCollection } from "../repo/apis";
import { parseQuery } from "../query/params";
import { runQuery } from "../query/build";
import { ingest } from "./pipeline";

const quoteRows = [
  { author: "Ada Lovelace", text: "The Analytical Engine has no pretensions", year: "1843" },
  { author: "Ada Lovelace", text: "That brain of mine is more than merely mortal", year: "1841" },
  { author: "Alan Turing", text: "We can only see a short distance ahead", year: "1950" },
  { author: "Grace Hopper", text: "A ship in port is safe", year: "1980" },
];

let db: Db;

beforeEach(async () => {
  db = getDb(":memory:");
  await ensureSchema(db);
});

describe("ingest pipeline", () => {
  test("creates api + collection, infers schema, coerces and inserts rows", async () => {
    const result = await ingest(db, {
      apiSlug: "quotes-api",
      rows: quoteRows,
    });

    expect(result.inserted).toBe(4);
    expect(result.schema).toEqual(
      expect.arrayContaining([
        { name: "author", type: "string" },
        { name: "text", type: "string" },
        { name: "year", type: "number" },
      ]),
    );

    const api = await getApiBySlug(db, "quotes-api");
    expect(api).not.toBeNull();
    expect(api?.name).toBe("Quotes Api");
    expect(api?.id).toBe(result.apiId);

    const collection = await getCollection(db, api!.id, "items");
    expect(collection).not.toBeNull();
    expect(collection?.name).toBe("Items");
    expect(collection?.id).toBe(result.collectionId);

    const spec = parseQuery(new URLSearchParams("sort=year"), collection!.schema);
    const { data, total } = await runQuery(db, collection!.id, spec, collection!.schema);
    expect(total).toBe(4);
    expect(data.map((r) => r.year)).toEqual([1841, 1843, 1950, 1980]);
    expect(typeof data[0]?.year).toBe("number");
    expect(data.every((r) => typeof r.author === "string")).toBe(true);
  });

  test("uses provided names/slugs and reuses an existing api on a second call", async () => {
    const first = await ingest(db, {
      apiSlug: "quotes-api",
      apiName: "Quotes",
      description: "Famous quotes",
      collectionSlug: "quotes",
      collectionName: "Quotes",
      rows: quoteRows.slice(0, 2),
    });

    const second = await ingest(db, {
      apiSlug: "quotes-api",
      collectionSlug: "quotes",
      rows: quoteRows.slice(2),
    });

    expect(second.apiId).toBe(first.apiId);
    expect(second.collectionId).toBe(first.collectionId);

    const api = await getApiBySlug(db, "quotes-api");
    expect(api?.name).toBe("Quotes");
    expect(api?.description).toBe("Famous quotes");

    const collection = await getCollection(db, api!.id, "quotes");
    const { total } = await runQuery(
      db,
      collection!.id,
      parseQuery(new URLSearchParams(""), collection!.schema),
      collection!.schema,
    );
    expect(total).toBe(4);
  });
});
