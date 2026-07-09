import { describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import { ingest } from "../ingest/pipeline";
import { getApiBySlug, getCollection, updateApi } from "../repo/apis";
import { parseQuery } from "../query/params";
import { runQuery } from "../query/build";
import { exportApi } from "./export";
import { importApi } from "./import";
import { serializeSpec, parseSpec } from "./serialize";

const quoteRows = [
  { author: "Ada Lovelace", text: "The Analytical Engine has no pretensions", year: "1843" },
  { author: "Alan Turing", text: "We can only see a short distance ahead", year: "1950" },
  { author: "Grace Hopper", text: "A ship in port is safe", year: "1980" },
];

async function freshDb(): Promise<Db> {
  const db = getDb(":memory:");
  await ensureSchema(db);
  return db;
}

describe("spec export/import round-trip", () => {
  test("ingest -> export -> serialize(yaml) -> parseSpec -> importApi -> runQuery matches source", async () => {
    const dbA = await freshDb();
    await ingest(dbA, {
      apiSlug: "quotes-api",
      apiName: "Quotes",
      collectionSlug: "quotes",
      collectionName: "Quotes",
      rows: quoteRows,
    });

    const spec = await exportApi(dbA, "quotes-api");
    expect(spec.slug).toBe("quotes-api");
    expect(spec.collections).toHaveLength(1);
    expect(spec.collections[0]?.records).toHaveLength(3);
    // no internal ids, no secrets
    expect(spec.collections[0]?.records.every((r) => !("id" in r))).toBe(true);
    expect(spec).not.toHaveProperty("readKey");
    expect(spec).not.toHaveProperty("writeToken");

    const yamlText = serializeSpec(spec, "yaml");
    expect(typeof yamlText).toBe("string");

    const parsed = parseSpec(yamlText);
    expect(parsed).toEqual(spec);

    const dbB = await freshDb();
    const { apiId } = await importApi(dbB, parsed);
    expect(apiId).toBeGreaterThan(0);

    const apiA = await getApiBySlug(dbA, "quotes-api");
    const collectionA = await getCollection(dbA, apiA!.id, "quotes");
    const apiB = await getApiBySlug(dbB, "quotes-api");
    const collectionB = await getCollection(dbB, apiB!.id, "quotes");

    expect(apiB?.name).toBe(apiA?.name);
    expect(collectionB?.schema).toEqual(collectionA?.schema);

    const specA = parseQuery(new URLSearchParams("sort=year"), collectionA!.schema);
    const specB = parseQuery(new URLSearchParams("sort=year"), collectionB!.schema);
    const resultA = await runQuery(dbA, collectionA!.id, specA, collectionA!.schema);
    const resultB = await runQuery(dbB, collectionB!.id, specB, collectionB!.schema);

    expect(resultB.total).toBe(resultA.total);
    // Compare record content ignoring internal id (ids differ across dbs).
    const stripId = (rows: Record<string, unknown>[]) =>
      rows.map(({ id: _id, ...rest }) => rest);
    expect(stripId(resultB.data)).toEqual(stripId(resultA.data));
  });

  test("importApi with overwrite replaces an existing api", async () => {
    const db = await freshDb();
    await ingest(db, { apiSlug: "quotes-api", rows: quoteRows.slice(0, 1) });

    const spec = await exportApi(db, "quotes-api");
    spec.collections[0]!.records = quoteRows.slice(0, 2).map((r) => ({
      ...r,
      year: Number(r.year),
    }));

    await importApi(db, spec, { overwrite: true });

    const api = await getApiBySlug(db, "quotes-api");
    const collection = await getCollection(db, api!.id, spec.collections[0]!.slug);
    const { total } = await runQuery(
      db,
      collection!.id,
      parseQuery(new URLSearchParams(""), collection!.schema),
      collection!.schema,
    );
    expect(total).toBe(2);
  });

  test("importApi without overwrite throws when the api already exists", async () => {
    const db = await freshDb();
    await ingest(db, { apiSlug: "quotes-api", rows: quoteRows.slice(0, 1) });
    const spec = await exportApi(db, "quotes-api");

    await expect(importApi(db, spec)).rejects.toThrow();
  });

  test("exportApi never includes a readKey configured on the api, even when it lives in config", async () => {
    const db = await freshDb();
    await ingest(db, { apiSlug: "quotes-api", rows: quoteRows.slice(0, 1) });
    // The public read gate (apps/web/lib/publicApi.ts) accepts a read key
    // stored either on the dedicated `read_key` column or at
    // `config.readKey` — exercise both to make sure neither leaks.
    await updateApi(db, "quotes-api", {
      readKey: "super-secret-read-key",
      config: { readKey: "also-super-secret" },
    });

    const spec = await exportApi(db, "quotes-api");

    expect(spec).not.toHaveProperty("readKey");
    expect(spec.config).not.toHaveProperty("readKey");
    expect(JSON.stringify(spec)).not.toContain("super-secret-read-key");
    expect(JSON.stringify(spec)).not.toContain("also-super-secret");
  });

  test("parseSpec rejects malformed / garbage input", () => {
    expect(() => parseSpec("not: valid: yaml: at: all: - [")).toThrow();
    expect(() => parseSpec("just a plain string")).toThrow();
    expect(() => parseSpec("{}")).toThrow();
    expect(() => parseSpec("slug: foo")).toThrow();
  });

  test("serializeSpec supports json format", async () => {
    const db = await freshDb();
    await ingest(db, { apiSlug: "quotes-api", rows: quoteRows.slice(0, 1) });
    const spec = await exportApi(db, "quotes-api");
    const jsonText = serializeSpec(spec, "json");
    expect(() => JSON.parse(jsonText)).not.toThrow();
    expect(parseSpec(jsonText)).toEqual(spec);
  });
});
