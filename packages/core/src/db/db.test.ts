import { describe, expect, test } from "vitest";
import { getDb, ensureSchema } from "./client";
import { apis } from "./schema";
import { eq } from "drizzle-orm";

describe("db client", () => {
  test("bootstraps schema and round-trips an api row on :memory:", async () => {
    const db = getDb(":memory:");
    await ensureSchema(db);

    const now = Date.now();
    await db.insert(apis).values({
      slug: "my-api",
      name: "My API",
      description: "A test API",
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(apis).where(eq(apis.slug, "my-api"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe("my-api");
    expect(rows[0]?.name).toBe("My API");
    expect(rows[0]?.config).toBe("{}");
  });
});
