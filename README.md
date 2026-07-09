# Fancy

**Paste data. Get a fancy API.**

Fancy turns a table you paste, a CSV you drop, or a declarative YAML/JSON
file into a live, queryable REST API in minutes — filtering, sorting,
pagination, and full-text search included, with an OpenAPI doc generated for
free. It started from a simple problem: an app with nowhere to store its
data shouldn't need a backend project to get one. Every API also gets an
[MCP](https://modelcontextprotocol.io) endpoint, so an AI agent can read and
write records the same way a person edits a spreadsheet — no custom
integration code required. Self-hostable with one `docker compose up`.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
![Built with Next.js](https://img.shields.io/badge/Next.js-15-black)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-SQLite-informational)
![pnpm workspaces](https://img.shields.io/badge/pnpm-workspaces-yellow)

Repo: [github.com/carmelosantana/fancy-api](https://github.com/carmelosantana/fancy-api)

---

## Screenshots

**Dashboard** — your APIs, at a glance.
![Fancy admin dashboard listing APIs with record and request counters](apps/web/public/shots/dashboard.png)

**Create an API** — paste a table, get a schema.
![Create-an-API form with a pasted table ready to submit](apps/web/public/shots/create.png)

**Instant success** — live endpoints, a write token, ready to use.
![Success panel showing a freshly created API's live endpoints](apps/web/public/shots/success.png)

**Query playground** — build a filtered request and see the response.
![Query playground building a filtered request and showing the JSON response](apps/web/public/shots/playground.png)

## Install

### Docker (recommended)

```bash
cp .env.example .env
make up
```

Open [http://localhost:3000](http://localhost:3000) and log in with the
`ADMIN_PASSWORD` from your `.env` (defaults to `change-me` — change it before
exposing this beyond your own machine).

The container seeds a demo API, `hello-tony`, on first start. Try it:

```bash
curl http://localhost:3000/api/hello-tony/quotes/random
```

```bash
make logs   # follow the web service
make down   # stop the stack (data persists in the fancy-data volume)
```

### Local dev

```bash
make install   # pnpm install
make seed      # populate the hello-tony demo against ./data/app.db
make dev       # next dev on http://localhost:3000
```

### Deploying somewhere else

Running Dokploy or Coolify (or anything Docker-based)? See
[Deploy on Dokploy / Coolify](#deploy-on-dokploy--coolify) below.

## The four ways to create an API

From `/admin/new`, pick one:

1. **Paste table** — paste tab- or comma-separated rows (e.g. straight out
   of a spreadsheet); Fancy infers column names and types.
2. **Upload CSV** — drop a `.csv` file.
3. **Paste CSV** — paste raw CSV text.
4. **Import declarative file** — paste a YAML or JSON spec that fully
   describes the api, its collection(s), and their schema + records.

A minimal declarative file looks like this:

```yaml
slug: hello-tony
name: Hello Tony Quotes
collections:
  - slug: quotes
    name: Quotes
    schema:
      - { name: author, type: string }
      - { name: text, type: string }
      - { name: year, type: number }
      - { name: topic, type: string }
    records:
      - author: Winston Churchill
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts."
        year: 1941
        topic: perseverance
```

`schema[].type` is one of `string`, `number`, `boolean`, `date`. Any api can
be exported back to this same shape from its detail page — the declarative
file is a portable import/export format, not the runtime store (see
[Architecture](#architecture)).

## Query syntax

Every collection gets a read API at `/api/{api}/{collection}`, plus
`/{id}`, `/random`, and an OpenAPI document at `/api/{api}/openapi.json`.
Responses are shaped `{ data, meta: { total, limit, offset } }` (a single
object, no `meta`, for `/{id}` and `/random`).

| Syntax | Meaning |
|---|---|
| `field=value` | Equals |
| `field_gt=value` / `field_gte=value` | Greater than / or equal |
| `field_lt=value` / `field_lte=value` | Less than / or equal |
| `field_ne=value` | Not equal |
| `field_contains=value` | Substring match |
| `field_in=a,b,c` | In a set |
| `sort=field,-other` | Sort ascending by `field`, then descending by `other` |
| `limit=n` | Page size (default `25`, max `100`) |
| `offset=n` | Page offset |
| `q=text` | Free-text search across the collection's string columns |

Examples against the seeded `hello-tony` demo:

```bash
# List, filtered and sorted
curl "http://localhost:3000/api/hello-tony/quotes?topic=perseverance&sort=-year"

# Pagination
curl "http://localhost:3000/api/hello-tony/quotes?limit=5&offset=10"

# Free-text search
curl "http://localhost:3000/api/hello-tony/quotes?q=courage"

# One random record — handy for a "quote of the day" widget
curl "http://localhost:3000/api/hello-tony/quotes/random"

# A single record by id
curl "http://localhost:3000/api/hello-tony/quotes/1"

# OpenAPI document for the whole api
curl "http://localhost:3000/api/hello-tony/openapi.json"
```

## Writing data with AI agents (MCP)

Every api gets a write-capable [MCP](https://modelcontextprotocol.io)
endpoint at `/api/mcp/{api}`, served over Streamable HTTP. Read-only tools
work without a token; the four mutating tools require the api's write token,
sent as `Authorization: Bearer <writeToken>`. The token is shown once when
the api is created and can be rotated from its detail page in `/admin` at
any time.

```json
{
  "mcpServers": {
    "hello-tony": {
      "url": "http://localhost:3000/api/mcp/hello-tony",
      "headers": {
        "Authorization": "Bearer <writeToken>"
      }
    }
  }
}
```

Tools exposed:

| Tool | Requires token | Description |
|---|---|---|
| `list_records` | No | Paginated list of a collection's records |
| `get_record` | No | Fetch one record by id |
| `query_records` | No | Filter, sort, and free-text search |
| `insert_record` | Yes | Insert a single record |
| `insert_records` | Yes | Insert multiple records at once |
| `update_record` | Yes | Shallow-merge a patch into a record by id |
| `delete_record` | Yes | Delete a record by id |

## Self-hosting

- **Persistence** — the sqlite database lives at `DATABASE_PATH` inside the
  container (default `/data/app.db`), backed by the named `fancy-data`
  Docker volume. `make down` stops the stack without touching it; `make
  clean` deletes it (with a confirmation prompt).
- **Admin password** — set `ADMIN_PASSWORD` in `.env` before first start.
  Fancy has a single admin credential, no multi-user accounts (v1).
- **Ports** — the container listens on `3000`; the compose file maps it to
  `3000` on the host. Change the left side of the `ports:` mapping in
  `docker-compose.yml` to use a different host port.
- **Seeding** — `SEED_ON_START=1` (the default) seeds the `hello-tony` demo
  on every start; it's idempotent, so this is safe to leave on. Set it to
  `0` for a blank instance.

## Deploy on Dokploy / Coolify

Fancy is a single Docker container plus one sqlite file, which maps cleanly
onto either platform. Two supported paths:

### Option A — Dockerfile app (recommended)

Point the platform at this repo (or a fork) and let it build `Dockerfile`
directly — no compose file needed.

1. **App type**: "Dockerfile" / "Application from Git", build context = repo
   root, dockerfile path = `Dockerfile`.
2. **Port**: the container listens on `3000` — tell the platform to route to
   that port.
3. **Volume — required**: attach a persistent volume mounted at **`/data`**.
   The sqlite database lives at `/data/app.db`; without a persistent mount
   at that path, every redeploy starts from an empty database. This is the
   single most important setting for either platform.
4. **Environment**: set the variables from the table below.
5. **Domain**: add a domain and enable HTTPS (see the HTTPS note below).

### Option B — Docker Compose

Point the platform at `docker-compose.yml` and let it deploy the `web`
service as-is.

1. Set the same environment variables (below) on the `web` service.
2. Map your domain to service `web`, container port `3000`.
3. The `ports:` mapping in `docker-compose.yml` (`${WEB_PORT:-3000}:3000`)
   is there for local `docker compose up` convenience — on a PaaS the
   platform's reverse proxy talks to the container directly over its
   internal network, so publishing a host port is usually unnecessary and
   can conflict with other stacks. The domain/proxy feature is what
   actually exposes the app publicly; the `fancy-data` named volume still
   provides the persistent `/data` mount either way.

### Required environment

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | The single admin login for `/admin` and the management API. |
| `SESSION_SECRET` | **Yes, for anything beyond a demo** | HMAC key signing the admin session cookie. Without it the app generates a random secret per process, so **every redeploy logs everyone out**. Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SEED_ON_START` | No | `1` (default) seeds the `hello-tony` demo API on start, idempotently. Set `0` for a blank instance. |
| `DATABASE_PATH` | No | Defaults to `/data/app.db`. Only change this if you also change where the persistent volume is mounted — it must always point inside that volume. |

### HTTPS note

Session cookies are marked `Secure` in production, so the app must be served
over HTTPS — the browser will silently drop the cookie otherwise and login
won't persist. Both Dokploy and Coolify default to a Traefik + Let's Encrypt
domain setup that handles this for you; if you instead hit the app over
plain HTTP by bare IP, expect to be logged out on every navigation.

### Scaling note

Fancy's storage is a single sqlite file (via libsql), not a networked
database — run **one instance only**. Multiple replicas pointed at the same
`/data` volume will corrupt or race on writes.

## Deploy on Vercel (with self-hosted libsql)

Vercel's filesystem is ephemeral (no persistent `/data` volume), so the
Docker/local-file mode above doesn't apply there. Instead, Fancy can connect
to a **remote libsql database** — the same SQLite engine, just reached over
HTTP(S) instead of a local file. The query builder, repo, ingest, and MCP
layers don't change at all; only the connection does.

### 1. Run a libsql server somewhere reachable over HTTPS

`sqld` (the libsql server) is a single lightweight process — self-host it on
any small always-on VPS (or use a hosted libsql provider like Turso). This
repo includes `docker-compose.sqld.yml` for the self-hosted route:

```bash
docker compose -f docker-compose.sqld.yml up -d
```

By default it listens with **no auth** (fine for a private network or while
wiring things up) on the host port `8899`. For a production deploy, put it
behind a TLS-terminating reverse proxy and enable JWT auth — see the
commented `SQLD_AUTH_JWT_KEY` guidance in that compose file — so you can
connect with a `libsql://` URL + bearer token instead of plain `http://`.

### 2. Configure the Vercel project

This is a pnpm monorepo (`apps/web` + `packages/core`). The simplest setup:

- In the Vercel project's **Settings → General → Root Directory**, set it to
  **`apps/web`**. Vercel auto-detects Next.js there and installs the pnpm
  workspace from the repo root on its own (it walks up to find
  `pnpm-workspace.yaml`), so `packages/core` is resolved correctly without
  any extra build-command overrides.
- If you'd rather not use the Root Directory setting (e.g. you want to keep
  deploying from the repo root for some other reason), a minimal
  `vercel.json` at the repo root with `"buildCommand": "pnpm --filter web
  build"` and `"outputDirectory": "apps/web/.next"` (plus `"installCommand":
  "pnpm install"`) achieves the same thing — but Root Directory is less to
  maintain, so this repo doesn't ship one.

### 3. Required environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | The remote libsql URL, e.g. `libsql://your-host` (or `http://your-host:8899` for the no-auth dev setup above). |
| `DATABASE_AUTH_TOKEN` | The JWT/token for that database. Leave unset for the no-auth dev setup. |
| `ADMIN_PASSWORD` | Same as the Docker deploy — the single admin login. |
| `SESSION_SECRET` | Same as the Docker deploy — set this or every redeploy invalidates sessions. |

Vercel serves everything over HTTPS by default, so the `Secure` session
cookie (see AGENTS.md) works out of the box — no HTTPS caveat to manage here
like the bare-IP case in the Dokploy/Coolify section above.

### 4. Seed once

Unlike the Docker image (which can seed on every container start), a
Vercel deployment has no "on start" hook against a remote DB. Seed it once
from your machine, pointed at the same database:

```bash
DATABASE_URL=libsql://your-host DATABASE_AUTH_TOKEN=your-token pnpm seed
```

### Honesty check / things to confirm on your own deploy

- The **local-file mode is completely unaffected** by any of this — nothing
  above changes `DATABASE_PATH` behavior, Docker, or `make up`.
- `next.config.ts`'s `output: "standalone"` is harmless on Vercel — Vercel
  builds Next.js natively and ignores `standalone` output, so no config
  change is needed there.
- `middleware.ts` runs on the Node.js runtime (`runtime: "nodejs"`) because
  `lib/auth.ts` uses `node:crypto`, which the default Edge middleware
  runtime doesn't support. This *should* work unmodified on Vercel, but
  Node-runtime middleware has had a narrower rollout than Edge middleware —
  **this hasn't been verified against an actual Vercel deployment**, so
  confirm `/admin` and `/api/_manage/*` auth still gate correctly on your
  first deploy.
- No Vercel deploy was performed as part of this change — the config above
  is written correct-by-construction from Vercel's documented monorepo
  behavior, not verified against a live deployment.

## Architecture

Monorepo, two packages:

- **`packages/core`** — the engine: ingest (CSV/paste/declarative-file
  parsing + type inference), the generic JSON-column record store, the
  query builder, the declarative import/export spec, and the MCP tool
  definitions. Framework-agnostic and meant to be reusable outside this
  Next.js app.
- **`apps/web`** — the Next.js (App Router) binding: the admin builder UI,
  the public read API, the management API, and the MCP HTTP route.

**Storage today is SQLite** (via `drizzle-orm/libsql` + `@libsql/client`) —
the query layer is built directly on SQLite's `json_extract`. It runs either
as a **local file** (`DATABASE_PATH`, the Docker/localhost default) or
against a **remote libsql database** (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`
— a self-hosted `sqld` or Turso, for ephemeral-FS hosts like Vercel; see
[Deploy on Vercel](#deploy-on-vercel-with-self-hosted-libsql) above) — it's
the same engine and protocol either way, so nothing downstream changes.
**Postgres is a roadmap item**, not a working option yet (see
`docker-compose.yml`'s commented-out `db` service and the design spec
below); switching backends will need query-layer changes, not just a
connection string.

The declarative file (YAML/JSON) is a **portable import/export** format for
moving an api's shape + data in and out of Fancy. The database is the
runtime source of truth — the file is a snapshot, not something Fancy reads
from at request time.

## Development

| Target | Does |
|---|---|
| `make install` | `pnpm install` |
| `make dev` | Seed the local DB, then run `next dev` |
| `make build` | Production build (`next build`) |
| `make test` | Unit tests (Vitest) |
| `make e2e` | Playwright end-to-end suite |
| `make seed` | Populate the `hello-tony` demo against the local DB |
| `make typecheck` | Typecheck every workspace package |
| `make up` | Build (if needed) and start the Docker stack |
| `make down` | Stop the stack (keeps data) |
| `make logs` | Follow the web service's logs |
| `make restart` | Restart the web service |
| `make clean` | Stop the stack and delete the data volume (confirms first) |
| `make nuke` | `clean`, plus prune this project's build caches/images |

Run `make` (or `make help`) to print this from the terminal.

## Testing

- **Unit** (`make test` / `pnpm test`) — 99 Vitest tests over
  `packages/core` and `apps/web`: ingest/type-inference, the query builder,
  the record repo, spec import/export, auth token handling, and the MCP
  tool definitions.
- **End-to-end** (`make e2e` / `pnpm e2e`) — 8 Playwright specs driving the
  real app: creating an api from a pasted table, the query playground, MCP
  round-trips, and more.

## Contributing

Design constraints and the decisions behind them live in [AGENTS.md](AGENTS.md) —
read it before making changes (~~human~~ or agent).

## License

[AGPL-3.0](LICENSE). If you run a modified version of Fancy as a network
service, the AGPL requires you to make your modified source available to
users of that service.
