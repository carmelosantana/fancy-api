import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin dashboard", () => {
  test("shows the hello-tony card with record/request counts", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    const card = page.getByTestId("api-card-hello-tony");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Hello Tony");
    await expect(card).toContainText("/api/hello-tony");

    // Record count is deterministic: global-setup always (re-)seeds exactly
    // the 22 quotes in packages/core/src/seed.ts. StatCounter animates from
    // 0 up to the real value, so wait for it to settle on the exact number
    // rather than asserting on the transient "0".
    await expect(card.getByTestId("record-count")).toHaveText("22", { timeout: 5_000 });

    // Request count is just asserted present/numeric — its exact value
    // depends on test execution order (other specs hit the public API too).
    await expect(card.getByTestId("request-count")).toHaveText(/^[\d,]+$/);
  });
});
