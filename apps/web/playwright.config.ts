import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN_PASSWORD, E2E_BASE_URL, E2E_DB_PATH, E2E_PORT } from "./e2e/testEnv";

/**
 * Runs the E2E suite against a PRODUCTION build (`next build && next start`)
 * on a dedicated port (3100) and a dedicated sqlite file (`data/e2e.db`,
 * distinct from the dev DB at `data/app.db` — see `e2e/testEnv.ts`), so
 * running `pnpm --filter web exec playwright test` never touches local dev
 * data. `e2e/global-setup.ts` seeds that same file (via the same
 * `E2E_DB_PATH`) once before the suite starts.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  globalSetup: path.resolve(__dirname, "./e2e/global-setup.ts"),
  webServer: {
    command: `next build && next start -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_PATH: E2E_DB_PATH,
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      PORT: String(E2E_PORT),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
