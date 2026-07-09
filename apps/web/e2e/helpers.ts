import { expect, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSWORD } from "./testEnv";

/** Logs in through the real `/login` UI form and waits for the `/admin` redirect. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/admin password/i).fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
