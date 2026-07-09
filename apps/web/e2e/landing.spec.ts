import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("loads with hero and a live quote", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: /paste data/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start building/i })).toBeVisible();

    const widget = page.getByTestId("live-quote-widget");
    await expect(widget).toBeVisible();

    // The widget starts in a loading skeleton state and fetches
    // /api/hello-tony/quotes/random client-side — wait for it to resolve
    // into a real, non-empty quote rather than staying in "loading"/"missing".
    const quoteText = page.getByTestId("live-quote-text");
    await expect(quoteText).toBeVisible({ timeout: 15_000 });
    const text = await quoteText.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(2);
  });
});
