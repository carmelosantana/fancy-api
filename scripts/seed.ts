/**
 * Populate the `hello-tony` demo API against the same sqlite file the web
 * app uses.
 *
 * DB path resolution is delegated to `@app/core`'s `resolveDbUrl()` (see
 * `packages/core/src/paths.ts`): `DATABASE_PATH` if set (relative values are
 * resolved against the repo root), else `<repoRoot>/data/app.db`. That's the
 * exact same function `apps/web/lib/db.ts` calls, so running `pnpm seed`
 * (repo root) and `pnpm dev` (apps/web) always agree on which file they're
 * touching.
 *
 * Usage:
 *   pnpm seed                    # idempotent — no-op if hello-tony exists
 *   SEED_OVERWRITE=1 pnpm seed   # drop + recreate hello-tony
 *   DATABASE_PATH=./data/e2e.db pnpm seed   # seed a different file
 */
import { ensureDbDir, ensureSchema, getDb, resolveDbUrl, seedHelloTony } from "@app/core";

async function main() {
  const url = resolveDbUrl();
  console.log(`[seed] using database: ${url}`);

  ensureDbDir(url);
  const db = getDb(url);
  await ensureSchema(db);

  const overwrite = process.env.SEED_OVERWRITE === "1";
  const result = await seedHelloTony(db, { overwrite });

  if (result.inserted === 0) {
    console.log(
      `[seed] hello-tony already exists (apiId=${result.apiId}); skipped (set SEED_OVERWRITE=1 to recreate).`,
    );
  } else {
    console.log(
      `[seed] seeded hello-tony (apiId=${result.apiId}): inserted ${result.inserted} quotes.`,
    );
  }

  console.log("[seed] endpoints:");
  console.log("  GET /api/hello-tony/quotes");
  console.log("  GET /api/hello-tony/quotes/random");
  console.log("  GET /api/hello-tony/quotes/1");
  console.log("  GET /api/hello-tony/openapi.json");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
