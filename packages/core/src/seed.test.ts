import { expect, test } from "vitest";
import { getDb, ensureSchema } from "./db/client";
import { getApiBySlug, getCollection } from "./repo/apis";
import { listRecords } from "./repo/records";
import { seedHelloTony } from "./seed";

async function freshDb() {
  const db = getDb(":memory:");
  await ensureSchema(db);
  return db;
}

test("seedHelloTony creates a queryable quotes collection", async () => {
  const db = await freshDb();

  const result = await seedHelloTony(db);
  expect(result.inserted).toBeGreaterThan(15);

  const api = await getApiBySlug(db, "hello-tony");
  expect(api).not.toBeNull();
  expect(api?.name).toBe("Hello Tony");

  const collection = await getCollection(db, api!.id, "quotes");
  expect(collection).not.toBeNull();
  const fieldNames = collection!.schema.map((c) => c.name).sort();
  expect(fieldNames).toEqual(["author", "text", "topic", "year"]);

  const { data, total } = await listRecords(db, collection!.id, { limit: 100, offset: 0 });
  expect(total).toBeGreaterThan(15);
  expect(data.length).toBe(total);
  for (const row of data) {
    expect(typeof row.author).toBe("string");
    expect(typeof row.text).toBe("string");
    expect(typeof row.year).toBe("number");
    expect(typeof row.topic).toBe("string");
  }
});

test("seedHelloTony is idempotent (no-op on second call)", async () => {
  const db = await freshDb();

  const first = await seedHelloTony(db);
  const api = await getApiBySlug(db, "hello-tony");
  const collection = await getCollection(db, api!.id, "quotes");
  const before = await listRecords(db, collection!.id, { limit: 200, offset: 0 });

  const second = await seedHelloTony(db);
  const after = await listRecords(db, collection!.id, { limit: 200, offset: 0 });

  expect(second.apiId).toBe(first.apiId);
  expect(second.inserted).toBe(0);
  expect(after.total).toBe(before.total);
});
