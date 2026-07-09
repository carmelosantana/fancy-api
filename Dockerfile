# syntax=docker/dockerfile:1
#
# Fancy — production image.
#
# Base: node:22-slim (Debian, glibc). @libsql/client ships prebuilt native
# bindings per platform+libc (@libsql/linux-x64-gnu, @libsql/linux-x64-musl,
# etc.), so a musl base (node:22-alpine) would technically also resolve a
# matching binary — but slim was verified end-to-end (build, standalone
# server boot, DB read/write) during development of this image, so it's the
# one we ship. See .superpowers/sdd/task-15-report.md for the alpine
# comparison notes.
#
# Three stages:
#   base   - Node + pnpm, shared by build and runner
#   build  - full workspace install, `next build` (standalone output), and
#            an esbuild bundle of the seed script (so seeding doesn't need
#            tsx/dev-deps in the runner)
#   runner - just the traced standalone server + static assets + seed
#            bundle, running as a non-root user

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# ---------------------------------------------------------------------------
FROM base AS build
WORKDIR /repo

# Install first with just the manifests, so `pnpm install` is cached across
# builds that only change application source.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter web build
RUN pnpm run seed:bundle

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/app.db

# curl is used by the compose healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 fancy \
  && useradd --system --uid 1001 --gid fancy --home-dir /app fancy \
  && mkdir -p /data \
  && chown -R fancy:fancy /data

WORKDIR /app

# `.next/standalone` is a self-contained server bundle: only the
# node_modules actually reachable from the traced dependency graph
# (see next.config.ts `output: "standalone"` / `outputFileTracingRoot`).
# Static assets and public files are excluded from the trace by design and
# must be copied in separately.
COPY --from=build --chown=fancy:fancy /repo/apps/web/.next/standalone ./
COPY --from=build --chown=fancy:fancy /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=fancy:fancy /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=fancy:fancy /repo/dist/seed.cjs ./apps/web/seed.cjs

COPY --chown=fancy:fancy docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER fancy
VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
