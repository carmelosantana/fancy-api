import { beforeEach, describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import type { ColumnSchema } from "../ingest/infer";
import {
  createApi,
  getApiBySlug,
  listApis,
  updateApi,
  deleteApi,
  createCollection,
  getCollection,
  listCollections,
  setCollectionSchema,
} from "./apis";
import { insertRecords, updateRecord, deleteRecord, listRecords } from "./records";

const schema: ColumnSchema[] = [
  { name: "title", type: "string" },
  { name: "year", type: "number" },
];

let db: Db;

beforeEach(async () => {
  db = getDb(":memory:");
  await ensureSchema(db);
});

describe("apis repo", () => {
  test("createApi + getApiBySlug round-trips with parsed config", async () => {
    const created = await createApi(db, {
      slug: "books",
      name: "Books API",
      config: { theme: "dark" },
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.config).toEqual({ theme: "dark" });

    const fetched = await getApiBySlug(db, "books");
    expect(fetched).not.toBeNull();
    expect(fetched?.slug).toBe("books");
    expect(fetched?.config).toEqual({ theme: "dark" });
  });

  test("getApiBySlug returns null for missing api", async () => {
    expect(await getApiBySlug(db, "nope")).toBeNull();
  });

  test("listApis returns all created apis", async () => {
    await createApi(db, { slug: "a", name: "A" });
    await createApi(db, { slug: "b", name: "B" });
    const all = await listApis(db);
    expect(all.map((a) => a.slug).sort()).toEqual(["a", "b"]);
  });

  test("updateApi patches fields and bumps updatedAt", async () => {
    const created = await createApi(db, { slug: "books", name: "Books API" });
    const updated = await updateApi(db, "books", { name: "Books API v2" });
    expect(updated.name).toBe("Books API v2");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  test("deleteApi cascades to collections and records", async () => {
    const api = await createApi(db, { slug: "books", name: "Books API" });
    const collection = await createCollection(db, {
      apiId: api.id,
      slug: "items",
      name: "Items",
      schema,
    });
    await insertRecords(db, collection.id, [{ title: "Dune", year: 1965 }]);

    await deleteApi(db, "books");

    expect(await getApiBySlug(db, "books")).toBeNull();
    expect(await getCollection(db, api.id, "items")).toBeNull();
    const { total } = await listRecords(db, collection.id);
    expect(total).toBe(0);
  });
});

describe("collections repo", () => {
  test("createCollection + getCollection round-trips with parsed schema", async () => {
    const api = await createApi(db, { slug: "books", name: "Books API" });
    const created = await createCollection(db, {
      apiId: api.id,
      slug: "items",
      name: "Items",
      schema,
    });
    expect(created.schema).toEqual(schema);

    const fetched = await getCollection(db, api.id, "items");
    expect(fetched?.schema).toEqual(schema);
  });

  test("listCollections returns collections for an api", async () => {
    const api = await createApi(db, { slug: "books", name: "Books API" });
    await createCollection(db, { apiId: api.id, slug: "items", name: "Items", schema });
    await createCollection(db, { apiId: api.id, slug: "authors", name: "Authors", schema });
    const all = await listCollections(db, api.id);
    expect(all.map((c) => c.slug).sort()).toEqual(["authors", "items"]);
  });

  test("setCollectionSchema updates the stored schema", async () => {
    const api = await createApi(db, { slug: "books", name: "Books API" });
    const created = await createCollection(db, {
      apiId: api.id,
      slug: "items",
      name: "Items",
      schema,
    });
    const newSchema: ColumnSchema[] = [...schema, { name: "author", type: "string" }];
    await setCollectionSchema(db, created.id, newSchema);
    const fetched = await getCollection(db, api.id, "items");
    expect(fetched?.schema).toEqual(newSchema);
  });
});

describe("records repo", () => {
  async function setupCollection() {
    const api = await createApi(db, { slug: "books", name: "Books API" });
    return createCollection(db, { apiId: api.id, slug: "items", name: "Items", schema });
  }

  test("insertRecords assigns sequential seq and returns inserted count", async () => {
    const collection = await setupCollection();
    const count = await insertRecords(db, collection.id, [
      { title: "Dune", year: 1965 },
      { title: "Foundation", year: 1951 },
    ]);
    expect(count).toBe(2);

    const { data, total } = await listRecords(db, collection.id);
    expect(total).toBe(2);
    expect(data.map((r) => r.title)).toEqual(["Dune", "Foundation"]);
  });

  test("insertRecords continues seq from current max", async () => {
    const collection = await setupCollection();
    await insertRecords(db, collection.id, [{ title: "Dune", year: 1965 }]);
    await insertRecords(db, collection.id, [{ title: "Foundation", year: 1951 }]);

    const { data } = await listRecords(db, collection.id);
    expect(data.map((r) => r.title)).toEqual(["Dune", "Foundation"]);
  });

  test("listRecords respects limit/offset and reports total", async () => {
    const collection = await setupCollection();
    await insertRecords(db, collection.id, [
      { title: "A", year: 1 },
      { title: "B", year: 2 },
      { title: "C", year: 3 },
    ]);

    const page = await listRecords(db, collection.id, { limit: 1, offset: 1 });
    expect(page.total).toBe(3);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.title).toBe("B");
  });

  test("updateRecord shallow-merges into existing data", async () => {
    const collection = await setupCollection();
    await insertRecords(db, collection.id, [{ title: "Dune", year: 1965 }]);
    const { data } = await listRecords(db, collection.id);
    const id = data[0]?.id as number;

    const updated = await updateRecord(db, collection.id, id, { year: 1966 });
    expect(updated).toEqual({ id, title: "Dune", year: 1966 });
  });

  test("updateRecord returns null for a missing record", async () => {
    const collection = await setupCollection();
    expect(await updateRecord(db, collection.id, 999999, { year: 1 })).toBeNull();
  });

  test("deleteRecord removes the record and returns true", async () => {
    const collection = await setupCollection();
    await insertRecords(db, collection.id, [{ title: "Dune", year: 1965 }]);
    const { data } = await listRecords(db, collection.id);
    const id = data[0]?.id as number;

    expect(await deleteRecord(db, collection.id, id)).toBe(true);
    const after = await listRecords(db, collection.id);
    expect(after.total).toBe(0);
  });

  test("deleteRecord returns false for a missing record", async () => {
    const collection = await setupCollection();
    expect(await deleteRecord(db, collection.id, 999999)).toBe(false);
  });
});
