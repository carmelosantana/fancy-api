import { getById } from "@app/core";
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
  { params }: { params: Promise<{ api: string; collection: string; id: string }> },
) {
  const { api: apiSlug, collection: collectionSlug, id } = await params;
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

  const numericId = Number(id);
  const record = Number.isInteger(numericId)
    ? await getById(database, collection.id, numericId)
    : null;

  if (!record) {
    logRequest(database, api.id, "GET", url.pathname, 404);
    return jsonWithCors({ error: "Record not found" }, { status: 404 });
  }

  logRequest(database, api.id, "GET", url.pathname, 200);
  return jsonWithCors({ data: record });
}
