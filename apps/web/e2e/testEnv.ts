import { join } from "node:path";
import { findRepoRoot } from "@app/core";

/**
 * Single source of truth for the E2E run's DB path/port/credentials —
 * imported by both `playwright.config.ts` (to set `webServer.env`) and
 * `e2e/global-setup.ts` (to seed that exact same file) so the two can never
 * drift apart. `findRepoRoot` is the same repo-root walk-up
 * `apps/web/lib/db.ts` and `scripts/seed.ts` use, so this resolves to the
 * same absolute-path convention as the rest of the app.
 *
 * This is a dedicated file — `<repoRoot>/data/e2e.db` — separate from the
 * dev DB (`<repoRoot>/data/app.db`), so running the E2E suite never
 * clobbers local dev data.
 */
const repoRoot = findRepoRoot(__dirname);

export const E2E_DB_PATH = join(repoRoot, "data", "e2e.db");
// NOTE: 3100 (the port suggested by the task spec) is permanently occupied
// on this dev box by a systemd-supervised BigBucket service for an
// unrelated project (`bigbucket-newburgh-leads.service`, auto-respawns on
// kill) — using it here would silently test the wrong app. 3411 is
// confirmed free and has no such supervisor.
export const E2E_PORT = 3411;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_ADMIN_PASSWORD = "test-pass";
