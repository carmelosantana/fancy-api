import type { Db } from "../db/client";
import { createApi, createCollection, deleteApi, getApiBySlug } from "../repo/apis";
import { insertRecords } from "../repo/records";
import type { ApiSpec } from "./types";

export interface ImportApiOptions {
  overwrite?: boolean;
}

export interface ImportApiResult {
  apiId: number;
}

/**
 * Materializes a declarative spec into the database: the api, its
 * collections, and their record data. Never imports secrets (specs don't
 * carry readKey/writeToken).
 */
export async function importApi(
  db: Db,
  spec: ApiSpec,
  opts: ImportApiOptions = {},
): Promise<ImportApiResult> {
  const existing = await getApiBySlug(db, spec.slug);
  if (existing) {
    if (!opts.overwrite) {
      throw new Error(`Api already exists: ${spec.slug} (pass overwrite: true to replace it)`);
    }
    await deleteApi(db, spec.slug);
  }

  const api = await createApi(db, {
    slug: spec.slug,
    name: spec.name,
    description: spec.description ?? null,
    config: spec.config ?? {},
  });

  for (const collectionSpec of spec.collections) {
    const collection = await createCollection(db, {
      apiId: api.id,
      slug: collectionSpec.slug,
      name: collectionSpec.name,
      schema: collectionSpec.schema,
    });
    if (collectionSpec.records.length > 0) {
      await insertRecords(db, collection.id, collectionSpec.records);
    }
  }

  return { apiId: api.id };
}
