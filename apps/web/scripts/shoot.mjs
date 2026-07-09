#!/usr/bin/env node
/**
 * Captures product screenshots for the landing page's "See it in action"
 * gallery against a *running* instance of the app (see the task runbook in
 * `.superpowers/sdd/homepage-deploy-report.md` for the exact boot sequence
 * this expects — a freshly seeded DB, `ADMIN_PASSWORD` matching this
 * process's env, and the server already answering on `BASE_URL`).
 *
 * Usage:
 *   ADMIN_PASSWORD=shots-pass BASE_URL=http://127.0.0.1:3599 node apps/web/scripts/shoot.mjs
 *
 * Writes PNGs to apps/web/public/shots/:
 *   dashboard.png   - /admin, hello-tony card with settled counters
 *   create.png      - /admin/new, filled form just before submit
 *   success.png     - the success panel right after creating the API
 *   playground.png  - the new API's detail page, query playground section
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "shots");

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3599";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error("[shoot] ADMIN_PASSWORD env var is required.");
  process.exit(1);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    // --- Log in through the real /login form -----------------------------
    console.log(`[shoot] logging in at ${BASE_URL}/login`);
    await page.goto("/login");
    await page.getByLabel(/admin password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin$/, { timeout: 15_000 });

    // --- 1. Dashboard ------------------------------------------------------
    console.log("[shoot] dashboard.png");
    await page.goto("/admin");
    const helloTonyCard = page.getByTestId("api-card-hello-tony");
    await helloTonyCard.waitFor({ state: "visible", timeout: 15_000 });
    // StatCounter animates from 0 up to the real value over ~900ms — wait
    // past that so we never freeze a mid-count transient in the screenshot.
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT_DIR, "dashboard.png") });

    // --- 2. Create form (filled, before submit) ---------------------------
    console.log("[shoot] create.png");
    await page.goto("/admin/new");
    const apiName = `Fun Crew ${Date.now()}`;
    await page.getByTestId("api-name-input").fill(apiName);
    const table = [
      "name\trole\tpower",
      "Rex\tTank\t9000",
      "Mia\tMage\t7500",
      "Kai\tRogue\t8200",
    ].join("\n");
    await page.getByTestId("table-paste-textarea").fill(table);
    // Let the preview table render before we screenshot the filled form.
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, "create.png") });

    // --- 3. Submit -> success panel ----------------------------------------
    console.log("[shoot] success.png");
    await page.getByTestId("create-api-submit").click();
    const successPanel = page.getByTestId("create-success-panel");
    await successPanel.waitFor({ state: "visible", timeout: 15_000 });
    // Give the confetti burst a moment to appear on screen.
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, "success.png") });

    // --- 4. API detail -> query playground ----------------------------------
    console.log("[shoot] playground.png");
    await page.getByRole("link", { name: /view api details/i }).click();
    await page.waitForURL(/\/admin\/apis\/.+/, { timeout: 15_000 });
    const playgroundSection = page.getByTestId("query-playground-section");
    await playgroundSection.waitFor({ state: "visible", timeout: 15_000 });
    await playgroundSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT_DIR, "playground.png") });

    console.log(`[shoot] done — screenshots written to ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[shoot] failed:", err);
  process.exit(1);
});
