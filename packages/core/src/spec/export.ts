import type { Db } from "../db/client";
import { getApiBySlug, listCollections } from "../repo/apis";
import { listRecords } from "../repo/records";
import type { ApiSpec, CollectionSpec } from "./types";

const EXPORT_PAGE_SIZE = 10_000;

/**
 * Assembles a portable, secret-free declarative spec for an api: its
 * collections and their record data (internal ids and secrets omitted).
 */
export async function exportApi(db: Db, apiSlug: string): Promise<ApiSpec> {
  const api = await getApiBySlug(db, apiSlug);
  if (!api) throw new Error(`Api not found: ${apiSlug}`);

  const collectionRows = await listCollections(db, api.id);

  const collections: CollectionSpec[] = [];
  for (const collection of collectionRows) {
    const { data } = await listRecords(db, collection.id, { limit: EXPORT_PAGE_SIZE });
    const records = data.map(({ id: _id, ...rest }) => rest);
    collections.push({
      slug: collection.slug,
      name: collection.name,
      schema: collection.schema,
      records,
    });
  }

  return {
    slug: api.slug,
    name: api.name,
    description: api.description ?? undefined,
    config: api.config,
    collections,
  };
}
