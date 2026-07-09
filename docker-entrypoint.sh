#!/bin/sh
# Container entrypoint: make sure the data directory exists, optionally seed
# the hello-tony demo, then hand off to the Next.js standalone server.
set -e

DB_PATH="${DATABASE_PATH:-/data/app.db}"
DB_DIR="$(dirname "$DB_PATH")"

mkdir -p "$DB_DIR"

if [ "${SEED_ON_START:-0}" = "1" ]; then
  echo "[entrypoint] SEED_ON_START=1 - running seed (idempotent, skips if hello-tony already exists)..."
  node /app/apps/web/seed.cjs
fi

echo "[entrypoint] starting Fancy on port ${PORT:-3000}..."
exec node /app/apps/web/server.js
