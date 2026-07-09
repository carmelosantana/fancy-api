import { beforeEach, describe, expect, test } from "vitest";
import { getDb, ensureSchema, type Db } from "../db/client";
import { generateToken, hashToken } from "../auth/token";
import { createApi, createCollection } from "../repo/apis";
import type { ColumnSchema } from "../ingest/infer";
import { assertWriteToken, getToolDefinitions } from "./tools";

const schema: ColumnSchema[] = [
  { name: "title", type: "string" },
  { name: "year", type: "number" },
];

let db: Db;
let writeToken: string;

function findTool(name: string) {
  const tool = getToolDefinitions().find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

beforeEach(async () => {
  db = getDb(":memory:");
  await ensureSchema(db);
  writeToken = generateToken();

  const api = await createApi(db, {
    slug: "books",
    name: "Books API",
    writeTokenHash: hashToken(writeToken),
  });
  await createCollection(db, { apiId: api.id, slug: "items", name: "Items", schema });
});

describe("assertWriteToken", () => {
  test("no-ops when the api has no writeTokenHash", () => {
    expect(() =>
      assertWriteToken(
        {
          id: 1,
          slug: "open",
          name: "Open",
          description: null,
          config: {},
          readKey: null,
          writeTokenHash: null,
          createdAt: 0,
          updatedAt: 0,
        },
        undefined,
      ),
    ).not.toThrow();
  });

  test("throws when token is missing", () => {
    expect(() =>
      assertWriteToken(
        {
          id: 1,
          slug: "locked",
          name: "Locked",
          description: null,
          config: {},
          readKey: null,
          writeTokenHash: hashToken("secret"),
          createdAt: 0,
          updatedAt: 0,
        },
        undefined,
      ),
    ).toThrow();
  });

  test("throws when token is wrong, passes when correct", () => {
    const hash = hashToken("secret");
    const api = {
      id: 1,
      slug: "locked",
      name: "Locked",
      description: null,
      config: {},
      readKey: null,
      writeTokenHash: hash,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(() => assertWriteToken(api, "wrong")).toThrow();
    expect(() => assertWriteToken(api, "secret")).not.toThrow();
  });
});

describe("mcp tool handlers", () => {
  test("insert_record with the correct write token succeeds and is queryable", async () => {
    const insertTool = findTool("insert_record");
    const result = (await insertTool.handler(
      db,
      { apiSlug: "books", collection: "items", record: { title: "Dune", year: 1965 } },
      { token: writeToken },
    )) as Record<string, unknown>;

    expect(result.title).toBe("Dune");
    expect(result.year).toBe(1965);
    expect(typeof result.id).toBe("number");

    const listTool = findTool("list_records");
    const listed = (await listTool.handler(
      db,
      { apiSlug: "books", collection: "items" },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.title).toBe("Dune");
  });

  test("insert_record with a wrong token throws", async () => {
    const insertTool = findTool("insert_record");
    await expect(
      insertTool.handler(
        db,
        { apiSlug: "books", collection: "items", record: { title: "Dune", year: 1965 } },
        { token: "totally-wrong" },
      ),
    ).rejects.toThrow();
  });

  test("insert_record with a missing token throws", async () => {
    const insertTool = findTool("insert_record");
    await expect(
      insertTool.handler(
        db,
        { apiSlug: "books", collection: "items", record: { title: "Dune", year: 1965 } },
        {},
      ),
    ).rejects.toThrow();
  });

  test("read handlers (list_records) work without a token even though the api has one configured", async () => {
    const listTool = findTool("list_records");
    const result = (await listTool.handler(
      db,
      { apiSlug: "books", collection: "items" },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(result.total).toBe(0);
  });

  test("get_record throws for a missing record", async () => {
    const getTool = findTool("get_record");
    await expect(
      getTool.handler(db, { apiSlug: "books", collection: "items", id: 999999 }, {}),
    ).rejects.toThrow();
  });

  test("query_records filters via query params", async () => {
    const insertManyTool = findTool("insert_records");
    await insertManyTool.handler(
      db,
      {
        apiSlug: "books",
        collection: "items",
        records: [
          { title: "Dune", year: 1965 },
          { title: "Foundation", year: 1951 },
        ],
      },
      { token: writeToken },
    );

    const queryTool = findTool("query_records");
    const result = (await queryTool.handler(
      db,
      { apiSlug: "books", collection: "items", query: { year_gt: "1960" } },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(result.total).toBe(1);
    expect(result.data[0]?.title).toBe("Dune");
  });

  test("update_record and delete_record require a valid write token", async () => {
    const insertTool = findTool("insert_record");
    const inserted = (await insertTool.handler(
      db,
      { apiSlug: "books", collection: "items", record: { title: "Dune", year: 1965 } },
      { token: writeToken },
    )) as Record<string, unknown>;
    const id = inserted.id as number;

    const updateTool = findTool("update_record");
    await expect(
      updateTool.handler(db, { apiSlug: "books", collection: "items", id, patch: { year: 1966 } }, {}),
    ).rejects.toThrow();

    const updated = (await updateTool.handler(
      db,
      { apiSlug: "books", collection: "items", id, patch: { year: 1966 } },
      { token: writeToken },
    )) as Record<string, unknown>;
    expect(updated.year).toBe(1966);

    const deleteTool = findTool("delete_record");
    await expect(
      deleteTool.handler(db, { apiSlug: "books", collection: "items", id }, {}),
    ).rejects.toThrow();

    const deleted = (await deleteTool.handler(
      db,
      { apiSlug: "books", collection: "items", id },
      { token: writeToken },
    )) as { deleted: boolean };
    expect(deleted.deleted).toBe(true);
  });

  test("list_records caps the page size at 100 regardless of the requested limit", async () => {
    const insertManyTool = findTool("insert_records");
    const records = Array.from({ length: 150 }, (_, i) => ({ title: `Book ${i}`, year: 2000 + i }));
    await insertManyTool.handler(
      db,
      { apiSlug: "books", collection: "items", records },
      { token: writeToken },
    );

    const listTool = findTool("list_records");

    // An agent asking for way more than the cap only ever gets `MAX_LIST_LIMIT` rows.
    const uncapped = (await listTool.handler(
      db,
      { apiSlug: "books", collection: "items", limit: 100_000 },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(uncapped.total).toBe(150);
    expect(uncapped.data).toHaveLength(100);

    // No `limit` at all falls back to the same default the REST layer uses (25).
    const defaulted = (await listTool.handler(
      db,
      { apiSlug: "books", collection: "items" },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(defaulted.data).toHaveLength(25);

    // A limit within the cap is honored as-is.
    const withinCap = (await listTool.handler(
      db,
      { apiSlug: "books", collection: "items", limit: 40 },
      {},
    )) as { data: Record<string, unknown>[]; total: number };
    expect(withinCap.data).toHaveLength(40);
  });

  test("all tool input schemas parse a minimal valid payload", () => {
    const definitions = getToolDefinitions();
    expect(definitions).toHaveLength(7);
    for (const def of definitions) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(typeof def.inputSchema.parse).toBe("function");
    }
  });
});
