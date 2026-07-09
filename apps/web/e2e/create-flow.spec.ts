import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("create API by pasting a table", () => {
  test("paste table -> create -> read the pasted rows back", async ({ page, request }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/new");

    const unique = `e2e-books-${Date.now()}`;
    await page.getByTestId("api-name-input").fill(`E2E Books ${unique}`);
    await page.getByTestId("api-slug-input").fill(unique);

    // "Paste table" is the default active tab; fill a small TSV directly
    // (tab-separated, first row = headers), matching the format the UI's
    // own "Use sample data" button demonstrates.
    const tsv = [
      "title\tauthor\tyear",
      "The Left Hand of Darkness\tUrsula K. Le Guin\t1969",
      "Dune\tFrank Herbert\t1965",
    ].join("\n");
    await page.getByTestId("table-paste-textarea").fill(tsv);

    await page.getByTestId("create-api-submit").click();

    await expect(page.getByRole("heading", { name: /your api is live/i })).toBeVisible({
      timeout: 15_000,
    });

    // No collectionSlug is sent by this form, so the pipeline defaults to "items".
    const endpointRow = page.getByTestId("endpoint-list");
    await expect(endpointRow).toContainText(`/api/${unique}/items`);

    const res = await request.get(`/api/${unique}/items`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);

    const titles = (body.data as Array<{ title: string }>).map((r) => r.title).sort();
    expect(titles).toEqual(["Dune", "The Left Hand of Darkness"]);

    const dune = (body.data as Array<{ title: string; author: string; year: number }>).find(
      (r) => r.title === "Dune",
    );
    expect(dune?.author).toBe("Frank Herbert");
    expect(dune?.year).toBe(1965);
  });
});
