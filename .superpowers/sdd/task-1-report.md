# Task 1 Report — Monorepo + Tooling Scaffold

## Environment
- Node: v26.4.0
- pnpm: 11.9.0
- Git branch: `master` (repo has no `main` branch — pre-existing repo state, not
  changed by this task; two prior commits already existed with the design spec
  and plan docs under `docs/superpowers/`).

## Structure created
- Root `package.json` (`declarative-api-platform`, private, packageManager
  pinned `pnpm@11.9.0`), scripts `typecheck` / `test` / `dev` / `build`.
- `pnpm-workspace.yaml` — `packages/*`, `apps/*`. pnpm 11's build-approval
  gate (`allowBuilds`) required an explicit true/false for two dependencies
  with postinstall/install scripts pulled in transitively (see below); both
  set to `true` in `pnpm-workspace.yaml`.
- `tsconfig.base.json` — strict, `moduleResolution: bundler`, `module: ESNext`,
  `target: ES2022`, `esModuleInterop`, `skipLibCheck`, `resolveJsonModule`,
  `types: ["node"]`.
- `.gitignore` — node_modules, .next, dist, data/, *.db, coverage, .env*,
  playwright-report, test-results, plus `*.tsbuildinfo` (added after a stray
  `apps/web/tsconfig.tsbuildinfo` build artifact showed up in `git status`;
  excluded before committing).
- `vitest.config.ts` (root) — node environment, `include:
  ["packages/**/*.test.ts"]`.
- `packages/core/` — `@app/core`, ESM, `src/index.ts` exporting
  `version = "0.1.0"`, `src/index.test.ts` asserting it via Vitest.
  `tsconfig.json` extends the base config.
- `apps/web/` — Next.js 15 App Router app, hand-written (no interactive
  `create-next-app`): `app/layout.tsx`, `app/page.tsx` (placeholder copy
  "Declarative API Platform — coming to life"), `app/globals.css` with the
  three Tailwind directives, `tailwind.config.ts`, `postcss.config.mjs`,
  `next.config.ts` (`transpilePackages: ["@app/core"]`), `tsconfig.json`
  (extends base, `jsx: preserve`, `next` plugin, `@/*` → `./`),
  `next-env.d.ts`.

## Dependency versions actually installed (via `pnpm ls`)
Root devDeps:
- `typescript@5.9.3` (requested `^5.7.3`)
- `vitest@3.2.7` (requested `^3.0.5`)
- `@types/node@22.20.0` (requested `^22.13.1`)

`packages/core` (`@app/core`) deps:
- `drizzle-orm@0.38.4`
- `@libsql/client@0.14.0`
- `zod@3.25.76`
- `papaparse@5.5.4`
- `yaml@2.9.0`
- `@modelcontextprotocol/sdk@1.29.0`

`packages/core` devDeps:
- `drizzle-kit@0.30.6`
- `@types/papaparse@5.5.2`

`apps/web` deps:
- `next@15.5.20`
- `react@19.2.7`
- `react-dom@19.2.7`
- `@app/core` → `workspace:*` (linked)
- `mcp-handler@1.1.0` — installed cleanly, **no substitution needed**.
- `zod@3.25.76`

`apps/web` devDeps: `typescript@5.9.3`, `@types/react@19.x`,
`@types/react-dom@19.x`, `@types/node@22.20.0`, `tailwindcss@3.4.17`
(pinned to v3, not v4, to keep the classic `tailwind.config.ts` +
`@tailwind` directive setup the plan asked for), `postcss@8.5.1`,
`autoprefixer@10.4.20`, `@playwright/test@1.50.x`.

All `^`-ranged requests resolved to the newest compatible version pnpm found
on the registry at install time (registry reachable, no pins were forced
except `tailwindcss` staying on the 3.x line per the plan's config style).

## Substitutions / deviations
- **None required for SQLite** — used `@libsql/client` +
  `drizzle-orm/libsql` per the constraint; `better-sqlite3` was never
  referenced.
- **`mcp-handler` installed successfully** — no fallback to
  `@modelcontextprotocol/sdk`-only was needed.
- pnpm 11's new build-script allowlist forced a one-time decision: `esbuild`
  (pulled in by `vitest`/`drizzle-kit`) and `sharp` (optional dep of `next`,
  used for image optimization) both have install/postinstall scripts. Both
  approved (`true`) in `pnpm-workspace.yaml` since they are well-known
  tooling/prebuilt-binary installers, not arbitrary third-party postinstall
  code. No native compilation occurred for the app's own runtime deps.
- Removed a stray `apps/web/tsconfig.tsbuildinfo` produced by `tsc --noEmit`
  before committing, and added `*.tsbuildinfo` to `.gitignore`.

## Verify command output

### `pnpm install`
Succeeded. `292` packages added, lockfile passes supply-chain policy check,
only the one build-approval prompt (handled above, non-interactively via
`pnpm-workspace.yaml`).

### `pnpm test`
```
$ vitest run
 RUN  v3.2.7 /home/carmelo/Projects/NextJS/fancy
 ✓ packages/core/src/index.test.ts (1 test) 2ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

### `pnpm -r typecheck`
```
Scope: 2 of 3 workspace projects
packages/core typecheck$ tsc --noEmit
packages/core typecheck: Done
apps/web typecheck$ tsc --noEmit
apps/web typecheck: Done
```
(Root package has no `typecheck` script of its own; `--if-present` skips it
as intended.)

### `pnpm --filter web build`
```
$ next build
   ▲ Next.js 15.5.20
 ✓ Compiled successfully in 3.5s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
Route (app)                                 Size  First Load JS
┌ ○ /                                      123 B         103 kB
└ ○ /_not-found                            993 B         104 kB
```
Full production build green, both routes prerendered as static content.

### `next dev` boot sanity check
Ran `next dev -p 3911` in the background, `curl -s -o /dev/null -w "%{http_code}"
http://localhost:3911/` returned `200`, dev log showed `✓ Ready in 1182ms` and
`GET / 200 in 2608ms`.

## Commit
All verify steps passed, so committed everything with:
```
git add -A && git commit -m "Task 1: pnpm monorepo scaffold + dependencies"
```
Commit hash: `8366ec2`
