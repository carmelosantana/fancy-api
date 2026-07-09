import { getApiBySlug, getCollection, requestLog, type ApiRow, type CollectionRow, type Db } from "@app/core";

/**
 * Shared plumbing for the public, read-only `/api/[api]/...` routes:
 * permissive CORS, the optional per-api read key, api/collection
 * resolution, and best-effort request logging.
 */

export const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
};

export function corsOptionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key, Content-Type",
    },
  });
}

export function jsonWithCors(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

function readKeyOf(api: ApiRow): string | undefined {
  if (api.readKey) return api.readKey;
  const config = api.config as { readKey?: unknown };
  return typeof config?.readKey === "string" ? config.readKey : undefined;
}

/** Returns a 401 Response if the api requires a read key and it's missing/wrong; null otherwise. */
export function checkReadKey(req: Request, api: ApiRow): Response | null {
  const required = readKeyOf(api);
  if (!required) return null;

  const url = new URL(req.url);
  const provided = req.headers.get("x-api-key") ?? url.searchParams.get("key");
  if (provided !== required) {
    return jsonWithCors({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return null;
}

export async function resolveApi(database: Db, apiSlug: string): Promise<ApiRow | null> {
  return getApiBySlug(database, apiSlug);
}

export async function resolveCollection(
  database: Db,
  api: ApiRow,
  collectionSlug: string,
): Promise<CollectionRow | null> {
  return getCollection(database, api.id, collectionSlug);
}

/**
 * Fire-and-forget request logging. Never awaited by callers, and swallows
 * its own errors, so a logging failure can never turn into a failed
 * response for the actual request.
 */
export function logRequest(
  database: Db,
  apiId: number | null,
  method: string,
  path: string,
  status: number,
): void {
  database
    .insert(requestLog)
    .values({ apiId, ts: Date.now(), method, path, status })
    .catch(() => {
      // best-effort only
    });
}
