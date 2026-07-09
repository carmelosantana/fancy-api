import { parseQuery, runQuery } from "@app/core";
import { db } from "@/lib/db";
import {
  checkReadKey,
  corsOptionsResponse,
  jsonWithCors,
  logRequest,
  resolveApi,
  resolveCollection,
} from "@/lib/publicApi";

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ api: string; collection: string }> },
) {
  const { api: apiSlug, collection: collectionSlug } = await params;
  const url = new URL(req.url);
  const database = await db();

  const api = await resolveApi(database, apiSlug);
  if (!api) {
    return jsonWithCors({ error: "Api not found" }, { status: 404 });
  }

  const keyError = checkReadKey(req, api);
  if (keyError) {
    logRequest(database, api.id, "GET", url.pathname, 401);
    return keyError;
  }

  const collection = await resolveCollection(database, api, collectionSlug);
  if (!collection) {
    logRequest(database, api.id, "GET", url.pathname, 404);
    return jsonWithCors({ error: "Collection not found" }, { status: 404 });
  }

  const spec = parseQuery(url.searchParams, collection.schema);
  const { data, total } = await runQuery(database, collection.id, spec, collection.schema);

  logRequest(database, api.id, "GET", url.pathname, 200);
  return jsonWithCors({ data, meta: { total, limit: spec.limit, offset: spec.offset } });
}
