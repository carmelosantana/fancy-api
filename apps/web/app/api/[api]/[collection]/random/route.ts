import { randomRecord } from "@app/core";
import { db } from "@/lib/db";
import {
  checkReadKey,
  corsOptionsResponse,
  jsonWithCors,
  logRequest,
  resolveApi,
  resolveCollection,
} from "@/lib/publicApi";

// A sibling static segment of `[id]/route.ts` — Next.js resolves static
// route segments before dynamic ones, so `/api/<api>/<collection>/random`
// hits this route rather than being captured as `id="random"`.

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

  const record = await randomRecord(database, collection.id);
  if (!record) {
    logRequest(database, api.id, "GET", url.pathname, 404);
    return jsonWithCors({ error: "Collection is empty" }, { status: 404 });
  }

  logRequest(database, api.id, "GET", url.pathname, 200);
  return jsonWithCors({ data: record });
}
