import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * Shared DB-path resolution.
 *
 * Both the web app (`apps/web/lib/db.ts`) and the seed script
 * (`scripts/seed.ts`) call `resolveDbUrl()` so they always point at the
 * exact same sqlite file, regardless of which directory each process was
 * launched from:
 *
 *  - `DATABASE_PATH`, if set, names the sqlite file. A relative value is
 *    resolved against the repo root (not `process.cwd()`), so `DATABASE_PATH`
 *    means the same thing whether you run `pnpm dev` (cwd `apps/web`) or
 *    `pnpm seed` (cwd repo root). An absolute value is used as-is.
 *  - Otherwise it defaults to `<repoRoot>/data/app.db`.
 *
 * The repo root is found by walking up from the starting directory until a
 * `pnpm-workspace.yaml` is found — this works no matter which package's
 * directory a given process happens to start in.
 */

/** Walk up from `startDir` until a directory containing `pnpm-workspace.yaml` is found. */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate repo root (no pnpm-workspace.yaml found above ${startDir})`,
      );
    }
    dir = parent;
  }
}

/**
 * Resolve the `file:` DB URL shared by the web app and the seed script.
 * See module docblock for the resolution rules.
 */
export function resolveDbUrl(startDir?: string): string {
  const repoRoot = findRepoRoot(startDir);
  const envPath = process.env.DATABASE_PATH;
  if (envPath) {
    const abs = isAbsolute(envPath) ? envPath : resolve(repoRoot, envPath);
    return `file:${abs}`;
  }
  return `file:${join(repoRoot, "data", "app.db")}`;
}

/**
 * Create the parent directory of a `file:` DB URL if it doesn't exist yet
 * (sqlite/libsql won't create it for you). No-op for `:memory:` or non-file
 * URLs. Shared by the web app and the seed script — both call this right
 * after `resolveDbUrl()`.
 */
export function ensureDbDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path === ":memory:" || path === "") return;
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
