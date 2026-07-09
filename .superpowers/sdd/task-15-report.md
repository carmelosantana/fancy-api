# Task 15 — Self-hosting & distribution (Docker, Makefile, README, LICENSE)

## Summary

Fancy is now self-hostable via Docker Compose, documented for both Docker
and local-dev workflows, and licensed under AGPL-3.0 with the full license
text committed. All verification steps ran for real — including an actual
Docker build + container run (Docker was available in this sandbox) — not
just static inspection.

## `output: 'standalone'` outcome

Enabled in `apps/web/next.config.ts`. Two things were required beyond the
one-line `output: "standalone"` flag:

1. **`outputFileTracingRoot`** — this is a pnpm workspace; `apps/web`'s own
   `node_modules` doesn't contain everything it resolves (workspace packages
   and hoisted deps live at the repo root). Without setting
   `outputFileTracingRoot` to the repo root, Next's file tracing anchors at
   `apps/web` and silently produces an incomplete/wrong standalone bundle.
   Computed directly in `next.config.ts` via `path.resolve(__dirname,
   "../..")` rather than importing `@app/core`'s `findRepoRoot()` — pulling
   a workspace package with its own dependency graph (drizzle-orm, zod,
   mcp-sdk) into `next.config.ts`'s load path felt fragile for a config file
   that Next loads standalone before the rest of the app's deps are
   necessarily resolved.

2. **A latent bug in `packages/core/src/paths.ts`'s `resolveDbUrl()`** — it
   called `findRepoRoot()` *unconditionally*, even on the branch that uses
   an absolute `DATABASE_PATH` and therefore never needs a repo root. This
   didn't matter in dev (a `pnpm-workspace.yaml` is always reachable by
   walking up from `cwd`), but it's fatal in the standalone Docker image:
   `.next/standalone` ships only the traced output, no
   `pnpm-workspace.yaml` anywhere above the container's `cwd`
   (`/app/apps/web`, since `server.js` does `process.chdir(__dirname)`).
   Confirmed by running the standalone bundle from `/tmp` with an absolute
   `DATABASE_PATH` before the fix — it crashed with "Could not locate repo
   root". Fixed by short-circuiting: an absolute `DATABASE_PATH` returns
   immediately without calling `findRepoRoot()` at all, matching what the
   function's own docstring already promised ("An absolute value is used
   as-is"). Verified: all 69 unit tests still pass unchanged, and the
   standalone server + a from-scratch `/tmp` reproduction both work
   post-fix.

`pnpm --filter web build` is green with no warnings after both changes.
Route list and bundle sizes are unchanged from the pre-standalone build.

## alpine vs. slim — tested, not guessed

Built the full image twice with everything else identical (same
Dockerfile, same COPY layout, same non-root user, same seed-bundle step) —
only the base image differed:

- **`node:22-alpine` (musl)**: image built fine, `pnpm install` correctly
  resolved the musl-specific optional dependency at install time, but the
  container **crashed at runtime**: `Error: Cannot find module
  '@libsql/linux-x64-musl'`. Next's build-time file tracing captured the
  `@libsql/linux-x64-gnu` native binary that had been present from the host
  install cache in one pass but the musl variant wasn't picked up the same
  way inside the alpine build — net effect, the traced `.next/standalone`
  output was missing the native binding `libsql` actually needed at
  runtime on musl. Image size: 88.9MB (never got to a working request).
- **`node:22-slim` (glibc/Debian)**: built and ran correctly end-to-end —
  server started, `GET /` returned 200, `GET
  /api/hello-tony/quotes/random` returned real data, and a container
  restart preserved data and re-ran the seed idempotently. Image size:
  121MB.

Shipped `node:22-slim`. The size delta (~32MB) is a small price for a base
that's actually been proven to work with this dependency; alpine remains
attractive in principle but would need the native-binding trace issue
solved first (e.g. explicitly force-including `@libsql/linux-x64-musl` in
Next's `outputFileTracingIncludes`, untested here).

## Docker — actually run, not just inspected

Docker 29.6.1 was available in this sandbox. Ran, in order:

1. `docker build` with the slim Dockerfile → succeeded.
2. `docker run` with `SEED_ON_START=1`, a named volume, port `3997:3000` →
   container started, seed ran (`inserted 22 quotes`), server came up
   (`Ready in 84ms`).
3. `curl localhost:3997/` → `200`; `curl
   localhost:3997/api/hello-tony/quotes/random` → a real quote JSON object.
4. `docker exec … curl 127.0.0.1:3000/` → `200` (simulating the compose
   healthcheck).
5. `docker restart` → data persisted, second seed run correctly logged
   "hello-tony already exists … skipped" (idempotency confirmed).
6. Repeated the same build with an alpine base → crashed at runtime (see
   above) — this is the direct evidence behind the slim choice, not a
   guess.
7. Ran the real golden path exactly as documented: `cp .env.example .env
   && make up` → image built, container started; polled
   `docker inspect --format='{{.State.Health.Status}}'` until `healthy`
   (2 polls, ~4s); `curl localhost:3000/` → `200`; `curl
   localhost:3000/api/hello-tony/quotes/random` → a quote; `make down` →
   clean stop, `fancy_fancy-data` volume left intact (as `make down`,
   unlike `make clean`, is documented to do).
8. `docker compose config` parses cleanly (checked separately too, see
   below).

Test containers/images (`fancy-test-slim`, `fancy-test-alpine`) and their
volumes were removed after comparison; the real `fancy:latest` image and
`fancy_fancy-data` volume built by the golden-path `make up` run were left
in place, since they're the actual working deliverable, not scratch state.

## `docker compose config`

Parses cleanly (`docker compose config` output inspected — correct env
interpolation, healthcheck, volume, and the commented-out Postgres block
left inert as intended).

## `make help`

Prints two sections (local dev targets, Docker targets) plus a "golden
path: make up && make logs" hint. Verified other targets individually
where meaningful: `make up` (full golden-path run, see above), `make down`,
`make logs` (tailed real output). `make clean`/`make nuke` were read-verified
but not executed against the live volume as part of this report (executing
`clean` would have deleted the demo data volume produced by the golden-path
run) — their logic is a straightforward `docker compose down` +
`docker volume rm` + confirmation prompt, consistent with `down`'s and
`up`'s already-verified behavior.

## Seed-in-container mechanism

`.next/standalone` doesn't include `scripts/seed.ts` or a TS runner — it
only traces what the Next.js server itself touches. Rather than shipping
`tsx` + dev-dependency source into the runner image, `scripts/seed.ts` is
bundled with `esbuild` (added as a proper root `devDependency`, since it
was only present as an untracked transitive dependency before — no
`.bin/esbuild` symlink existed) into a single CJS file
(`pnpm run seed:bundle` → `dist/seed.cjs`, external only `@libsql/client`
and `libsql` so it shares the server's already-traced native binding
instead of duplicating it). The Dockerfile copies this bundle to
`apps/web/seed.cjs`, next to `server.js`, specifically so Node's module
resolution finds the same `node_modules/@libsql` the server uses.
`docker-entrypoint.sh` runs it with plain `node` when `SEED_ON_START=1`,
before `exec`-ing the server.

## Deviations from the literal task text

- Used `node:22-slim`, not alpine — per the task's own instruction to test
  and prefer whichever runs; alpine measurably didn't (see above).
- Added `esbuild` as an explicit root `devDependency` (not previously
  declared, only present transitively) to make `pnpm run seed:bundle`
  reproducible rather than relying on whichever transitive esbuild version
  happened to be hoisted.
- Fixed a small, narrowly-scoped bug in `packages/core/src/paths.ts`
  (`resolveDbUrl` calling `findRepoRoot` unconditionally) — necessary for
  the standalone image to run at all with an absolute `DATABASE_PATH`, and
  arguably brings the code in line with its own docstring. All 69 existing
  unit tests plus the 8 Playwright E2E specs still pass unchanged after the
  fix.
- Added `apps/web/public/.gitkeep` — the app currently has no `public/`
  directory, but the Dockerfile's `COPY --from=build … apps/web/public
  ./apps/web/public` step (a documented part of the standalone deployment
  convention, and forward-compatible with a future favicon/static asset)
  needs the directory to exist at build time.
- `pnpm e2e` printed one non-fatal advisory: `"next start" does not work
  with "output: standalone" configuration. Use "node
  .next/standalone/server.js" instead.` This comes from Playwright's dev
  `webServer` command (`next start`, used for local E2E runs, unrelated to
  the Docker image) and is purely informational — the dev server still
  started correctly and all 8 specs passed. Left `playwright.config.ts`
  untouched since it's outside this task's scope and not broken, just
  noisy; flagging here for visibility.
- `.gitignore` had a blanket `.env.*` rule that would have silently
  excluded the required `.env.example` from version control. Added a
  `!.env.example` negation line so it's tracked.

## Make targets (final list)

Local dev: `install`, `dev`, `build`, `test`, `e2e`, `seed`, `typecheck`.
Docker: `up`, `down`, `logs`, `restart`, `clean` (confirms before deleting
the data volume), `nuke` (`clean` + prune this project's build cache/image).
`help` is the default goal.

## Files added/changed

- Added: `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`,
  `.env.example`, `.dockerignore`, `Makefile`, `README.md`, `LICENSE`,
  `apps/web/public/.gitkeep`.
- Changed: `apps/web/next.config.ts` (standalone output +
  outputFileTracingRoot), `packages/core/src/paths.ts` (lazy
  `findRepoRoot`), `package.json` (added `esbuild` devDependency +
  `seed:bundle` script), `pnpm-lock.yaml` (from the `esbuild` add),
  `.gitignore` (`.env.example` exception).
