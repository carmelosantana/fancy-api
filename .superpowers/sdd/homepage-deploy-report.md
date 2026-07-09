# Homepage polish + deployment readiness — report

Branch: `feat/sort-random`. Public repo linked everywhere:
https://github.com/carmelosantana/fancy-api

Commits (this task, oldest first):

1. `a5d93e8` — `feat(web): homepage branding polish for public release`
2. `9f0b2a8` — `feat(web): add Playwright screenshot capture script + product shots`
3. `c7efa96` — `docs: deployment guide for Dokploy/Coolify + screenshots`

No branch changes, no pushes, no `.env`/secrets touched.

## Part 1 — Homepage / branding polish

**New files**
- `apps/web/components/ui/GitHubIcon.tsx` — inline SVG GitHub mark, `className` prop, no external deps.
- `apps/web/components/landing/ScreenshotGallery.tsx` — "See it in action" gallery, 2-col responsive grid of captioned cards (`<figure>`/`<figcaption>`), `loading="lazy"`, `overflow-x-auto` wrapper per image so the page never scrolls horizontally, descriptive `alt` text per shot.
- `apps/web/components/landing/InstallSection.tsx` — "How to install" section using the existing `Tabs` + `CodeBlock` components: Docker one-liner, local dev (`make install && make seed && make dev`), and a Dokploy/Coolify tab linking to the README's `#deploy-on-dokploy--coolify` anchor on GitHub.

**Edited files**
- `apps/web/components/NavBar.tsx` — exports `GITHUB_REPO_URL`; replaced the `<a href="https://github.com">OSS · AGPL</a>` placeholder with a badge-pill GitHub icon + "⭐ Star on GitHub" link (`target="_blank" rel="noreferrer"`).
- `apps/web/app/page.tsx` — the 📜 "OSS · AGPL" feature card is now "Open source (AGPL-3.0)" with the `GitHubIcon`, invites a star, and the whole card links to the repo (`<a>` instead of `<div>` when `href` is set). Footer keeps the AGPL-3.0 note and adds a GitHub icon + repo link. Wired in `ScreenshotGallery` and `InstallSection` between the feature grid and the CTA footer.
- `apps/web/components/admin/ApiDetailClient.tsx` / `FilterPlayground.tsx` — added `data-testid="query-playground-section"` and `data-testid="filter-playground-send"` for stable screenshot/E2E targeting (no behavior change).

**LiveQuoteWidget** — inspected `apps/web/components/landing/LiveQuoteWidget.tsx`; it already has a dedicated `"missing"` state (404 or empty `data` → friendly "hasn't been seeded on this instance yet" message, never a crash or blank screen) plus a separate `"error"` state for network/HTTP failures. No changes were needed; verified by reading the code path, not by simulating a missing `hello-tony` (the shots run always has it seeded).

**Copy tightening** — reviewed hero/steps/features/CTA copy; it already reads as public-facing (no internal jargon, TODOs, or dev-only references), so only the OSS card/footer/nav changes described above were made.

## Part 2 — Automated screenshots

**New file**: `apps/web/scripts/shoot.mjs` — standalone Playwright script (not the test runner): chromium headless, 1440x900 viewport, `deviceScaleFactor: 2`, `colorScheme: "dark"`. Flow: log in via the real `/login` form → `/admin` (waits past the 900ms `StatCounter` animation before capturing, so the count is settled, not mid-tween) → `/admin/new` (fills name + a small fun TSV table: `name/role/power` — Rex/Mia/Kai) → submit → success panel (waits for `data-testid="create-success-panel"` + a short confetti settle) → clicks "View API details →" → waits for the new `query-playground-section` testid → screenshot.

**Run sequence executed**:
1. `pnpm --filter web build`
2. `DATABASE_PATH=.../data/shots.db pnpm seed` (fresh DB, 22 hello-tony quotes)
3. `PORT=3599 ADMIN_PASSWORD=shots-pass SESSION_SECRET=shots-secret DATABASE_PATH=.../data/shots.db pnpm --filter web start` in background; polled `/` until 200
4. `ADMIN_PASSWORD=shots-pass BASE_URL=http://127.0.0.1:3599 node apps/web/scripts/shoot.mjs`
5. Killed the server, deleted `data/shots.db*` (never committed — `data/` is gitignored)

One re-run was needed: the first pass captured `dashboard.png` mid-`StatCounter`-animation (froze at "6" instead of the settled "22"); fixed by replacing an under-specified `waitForFunction` with a flat `waitForTimeout(1400)` (comfortably past the 900ms animation) and reran end-to-end against a freshly reseeded DB so the dashboard shows only `hello-tony` (a first accidental run had left an extra "Fun Crew" test API in the DB from the timing-bug run).

**Screenshots committed** (`apps/web/public/shots/`):
| File | Size |
|---|---|
| `dashboard.png` | 388 KB |
| `create.png` | 463 KB |
| `success.png` | 598 KB |
| `playground.png` | 636 KB |

All visually verified (Read tool image preview): dashboard shows the Hello Tony card with settled "22 records"; create.png shows the filled name/slug/pasted table with live preview; success.png shows the confetti + endpoints + write-token reveal; playground.png shows the query playground (filters, sort, limit, Send, curl block) scrolled into view.

**GIF**: **not produced** — deliberately skipped per the task's own time-box ("if fiddly, skip"). Playwright's bundled ffmpeg was located at `~/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux` for future use, but recording+converting a video was judged not worth the extra runtime given screenshots were the hard requirement.

## Part 3 — README deployment docs

- Consolidated the two existing quickstarts under a new top-level `## Install` heading (`### Docker (recommended)`, `### Local dev`), plus a `### Deploying somewhere else` pointer to the new Dokploy/Coolify section.
- Added `## Screenshots` (near the top, right after the badges) embedding all 4 shots via repo-relative paths (`apps/web/public/shots/*.png`), which render on github.com.
- Added `## Deploy on Dokploy / Coolify` (placed after the existing `## Self-hosting` section) covering:
  - **Option A — Dockerfile app**: build context = repo root, `Dockerfile`, container port `3000`, **persistent volume at `/data` called out as required** (sqlite lives there, wiped on redeploy otherwise), env, domain+HTTPS.
  - **Option B — Docker Compose**: deploy `docker-compose.yml`, map domain to `web:3000`, note that the local `ports:` mapping is a local-dev convenience and the PaaS's own domain/proxy feature is what exposes it publicly.
  - **Required environment table**: `ADMIN_PASSWORD`, `SESSION_SECRET` (flagged required beyond a demo, with the `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` generator), `SEED_ON_START`, `DATABASE_PATH`.
  - **HTTPS note**: `Secure` cookies in production; both platforms default to Traefik/Let's Encrypt; plain-HTTP-by-IP breaks login persistence.
  - **Scaling note**: single instance only, no replicas against one sqlite volume.
- `docker-compose.yml`: added `expose: ["3000"]` with a comment explaining the PaaS-routing rationale, directly above the untouched `ports: - "${WEB_PORT:-3000}:3000"` line. Validated with `docker compose config` (parses cleanly; `expose` accepted).
- Fixed a stale, unrelated inaccuracy noticed in the same section: the Testing section said "69 Vitest tests" — actual count is 99 (`pnpm test` output), so corrected it in passing.

## Verification (captured output)

- `pnpm --filter web typecheck` — clean, no errors.
- `pnpm --filter web build` — green; all routes compile, including the new landing components; `public/shots/*.png` present in the output tree.
- `pnpm test` — **99/99 passed**, 14 test files (packages/core + apps/web), 1.55–1.64s.
- Screenshot files confirmed present and non-trivial: 388 KB / 463 KB / 598 KB / 636 KB (see table above).
- Booted the production build on a scratch port (3897) against the normal dev DB, `curl http://127.0.0.1:3897/` → 200; confirmed all 4 `<img src="/shots/*.png">` tags resolve 200 and the GitHub repo URL string is present in the rendered HTML.
- Used the `preview_start`/`preview_screenshot`/`preview_eval` tools against `next dev` (port 3000) to visually confirm: nav "⭐ Star on GitHub" pill, feature-card grid with the GitHub-icon OSS card, the "See it in action" gallery (2-col, captioned, rounded cards), the "How to install" tabs (Docker/Local dev/Dokploy-Coolify, each switching content correctly), and the footer GitHub link. No console errors.

## Deviations from the spec

- GIF not produced (explicitly optional and time-boxed off, as noted above).
- Added a "Deploying somewhere else" one-liner + a repo-link line near the README's badges — small additions beyond the literal ask, kept minimal, in service of "link the repo everywhere."
- Corrected the README's stale "69 Vitest tests" line to 99 while in that section — not explicitly requested but directly served "keep the existing docs accurate."
- `data-testid="query-playground-section"` and `data-testid="filter-playground-send"` were added (not pre-existing) specifically to make the screenshot script's fourth capture deterministic; this is a small, additive change to production components, not test-only code.
