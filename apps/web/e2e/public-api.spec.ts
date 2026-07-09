import { expect, test } from "@playwright/test";

test.describe("public read API (hello-tony/quotes)", () => {
  test("lists quotes with a data/meta envelope", async ({ request }) => {
    const res = await request.get("/api/hello-tony/quotes");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta).toMatchObject({ total: expect.any(Number) });
    expect(body.data[0]).toHaveProperty("author");
    expect(body.data[0]).toHaveProperty("text");
    expect(body.data[0]).toHaveProperty("year");
  });

  test("random returns a single quote", async ({ request }) => {
    const res = await request.get("/api/hello-tony/quotes/random");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data).toBeTruthy();
    expect(typeof body.data.text).toBe("string");
    expect(body.data.text.length).toBeGreaterThan(0);
  });

  test("filters with year_gt return only matching rows", async ({ request }) => {
    const res = await request.get("/api/hello-tony/quotes?year_gt=1980");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const row of body.data) {
      expect(row.year).toBeGreaterThan(1980);
    }
  });

  test("free-text search (q) returns only matching rows", async ({ request }) => {
    // "impossible" appears in two seeded quotes (Mandela, Tony Robbins).
    const res = await request.get("/api/hello-tony/quotes?q=impossible");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const row of body.data) {
      const hit = Object.values(row).some(
        (v) => typeof v === "string" && v.toLowerCase().includes("impossible"),
      );
      expect(hit).toBe(true);
    }
  });

  test("openapi.json is valid JSON with paths for the quotes collection", async ({ request }) => {
    const res = await request.get("/api/hello-tony/openapi.json");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    const body = await res.json();
    expect(body.openapi).toBeTruthy();
    expect(body.paths).toBeTruthy();
    expect(body.paths["/quotes"]).toBeTruthy();
    expect(body.paths["/quotes/random"]).toBeTruthy();
    expect(body.paths["/quotes/{id}"]).toBeTruthy();
  });
});
