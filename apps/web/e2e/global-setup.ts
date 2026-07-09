import { ensureDbDir, ensureSchema, getDb, seedHelloTony } from "@app/core";
import { E2E_DB_PATH } from "./testEnv";

/**
 * Runs once before the whole Playwright suite. Seeds the dedicated E2E
 * sqlite file (see `testEnv.ts`) directly — independent of whatever process
 * ends up serving `webServer` — with a deterministic `hello-tony` fixture
 * (`{ overwrite: true }` so re-runs always start from the same 22 quotes,
 * regardless of what a previous run's `create-flow` test may have left
 * behind in other APIs).
 *
 * Deliberately does NOT delete the e2e.db file itself: `webServer`'s
 * `reuseExistingServer: !CI` may already have a `next start` process holding
 * it open locally, and unlinking out from under a live connection is asking
 * for trouble. `ensureSchema` (idempotent `CREATE TABLE IF NOT EXISTS`) plus
 * a targeted delete-and-reinsert of just the hello-tony rows is enough.
 */
export default async function globalSetup() {
  const url = `file:${E2E_DB_PATH}`;
  ensureDbDir(url);

  const db = getDb(url);
  await ensureSchema(db);
  const result = await seedHelloTony(db, { overwrite: true });

  console.log(
    `[e2e:globalSetup] hello-tony ready (apiId=${result.apiId}, inserted=${result.inserted}) at ${url}`,
  );
}
