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
  const envPath = process.env.DATABASE_PATH;
  // An absolute DATABASE_PATH is used as-is and never needs a workspace
  // root, so skip the findRepoRoot() walk entirely in that case. This
  // matters for containerized/standalone deployments (e.g. the Docker
  // image), which ship only the traced output — no pnpm-workspace.yaml
  // anywhere above cwd — and always set an absolute DATABASE_PATH.
  if (envPath && isAbsolute(envPath)) {
    return `file:${envPath}`;
  }
  const repoRoot = findRepoRoot(startDir);
  if (envPath) {
    return `file:${resolve(repoRoot, envPath)}`;
  }
  return `file:${join(repoRoot, "data", "app.db")}`;
}

/** Matches a remote libsql/HTTP(S)/WebSocket URL — anything that isn't a local file. */
const REMOTE_URL_RE = /^(libsql|https?|wss?):\/\//;

/**
 * Resolve the DB connection config shared by the web app and the seed
 * script: either a **remote** libsql database (Vercel / any ephemeral-FS
 * host) or the existing **local file** (localhost + Docker).
 *
 * Precedence:
 *  - `DATABASE_URL` set and remote-shaped (`libsql://`, `http(s)://`,
 *    `ws(s)://`) → remote mode: `{ url: DATABASE_URL, authToken:
 *    DATABASE_AUTH_TOKEN }`. This is how you point Fancy at a self-hosted
 *    `sqld` (or Turso) instance — see `docker-compose.sqld.yml` and the
 *    README's "Deploy on Vercel" section.
 *  - Otherwise → local file mode, unchanged: `{ url: resolveDbUrl(startDir) }`.
 *
 * `DATABASE_PATH` and `DATABASE_URL` are mutually exclusive in practice: set
 * `DATABASE_URL` for remote, leave it unset (optionally set `DATABASE_PATH`)
 * for local file.
 */
export function resolveDbConfig(startDir?: string): { url: string; authToken?: string } {
  const remoteUrl = process.env.DATABASE_URL;
  if (remoteUrl && REMOTE_URL_RE.test(remoteUrl)) {
    return { url: remoteUrl, authToken: process.env.DATABASE_AUTH_TOKEN };
  }
  return { url: resolveDbUrl(startDir) };
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
