# Homepage Polish + Deployment Readiness — Design

**Date:** 2026-07-09
**Status:** Approved → implementing

## Goal
Get Fancy's landing page and docs ready for a public release and PaaS deployment
(Dokploy / Coolify), keep the localhost path working, and publish the repo at
`github.com/carmelosantana/fancy-api`.

## Scope (approved)

### 1. Homepage focused polish (keep current modern dark vibe — no 90s theme)
- Replace all three "OSS · AGPL" placeholders (nav link, 📜 feature card, footer)
  with a real **GitHub mark** linking to `https://github.com/carmelosantana/fancy-api`.
  Add a small inline `GitHubIcon` SVG component (no new deps). Add a "⭐ Star on
  GitHub" CTA.
- Tighten public-facing copy. Ensure `LiveQuoteWidget` degrades gracefully when
  `hello-tony` is absent (no crash, friendly placeholder).
- Add a **"See it in action"** gallery section showing real product screenshots.
- Add an on-page **"How to install"** section (Docker one-liner + local dev +
  link to full deploy docs).

### 2. Automated screenshots / GIFs (Playwright)
- A capture script drives the real flow against a freshly-seeded instance on a
  dedicated test port + test DB: landing → login → dashboard → new API (paste a
  fun table) → 🎉 success → API detail/playground.
- Save PNGs to `apps/web/public/shots/` (served + embeddable): at least
  `dashboard.png`, `create.png`, `success.png`, `playground.png`, `quote.png`.
- Optional GIF of the create flow via Playwright video + its bundled ffmpeg
  (`~/.cache/ms-playwright/ffmpeg-1011`). Screenshots are the must-have.
- Embed in the landing gallery + README.

### 3. Deployment readiness — Dokploy / Coolify
The Docker image is already PaaS-ready (`EXPOSE 3000`, `HOSTNAME=0.0.0.0`,
non-root, standalone output, curl healthcheck, `/data` volume). Work is docs +
small compatibility polish:
- **README "Deploy on Dokploy / Coolify"** covering BOTH paths:
  - **Dockerfile app** (recommended): build from Dockerfile, container port 3000,
    attach a **persistent volume at `/data`** (REQUIRED — else SQLite is wiped on
    redeploy), set env, add domain (HTTPS).
  - **Compose**: use `docker-compose.yml`, set env, map domain → `web:3000`.
- **Required env, documented loudly:** `ADMIN_PASSWORD` and `SESSION_SECRET`
  (without the secret, all sessions drop on each restart/redeploy). `SEED_ON_START`
  optional.
- **HTTPS note:** cookies are `Secure` in production, so the proxy must terminate
  TLS (Traefik/Let's Encrypt — default on both platforms).
- **Single instance only** (SQLite → no horizontal scaling).
- Keep the local `make up` / `WEB_PORT` path exactly as proven.
- README gets a top-level **"Install"** quickstart.

### 4. Ship
- Consolidate `feat/sort-random` → `main` (main = full history incl. `sort=random`).
- `pnpm test` (unit) + `pnpm --filter web build` green; smoke the rebuilt app.
- Create the **public** repo `carmelosantana/fancy-api`, push `main`.

## Non-goals
- No 90s/retro theme (considered, dropped).
- No Postgres wiring (still roadmap).
- No multi-user/OAuth/gamification (roadmap wrapper).
