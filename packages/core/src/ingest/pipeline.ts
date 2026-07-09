import type { Db } from "../db/client";
import {
  createApi,
  createCollection,
  getApiBySlug,
  getCollection,
  setCollectionSchema,
} from "../repo/apis";
import { insertRecords } from "../repo/records";
import { coerceRow, inferColumns, type ColumnSchema } from "./infer";

const DEFAULT_COLLECTION_SLUG = "items";

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface IngestInput {
  apiSlug: string;
  apiName?: string;
  description?: string;
  collectionSlug?: string;
  collectionName?: string;
  rows: Record<string, string>[];
}

export interface IngestResult {
  apiId: number;
  collectionId: number;
  inserted: number;
  schema: ColumnSchema[];
}

export async function ingest(db: Db, input: IngestInput): Promise<IngestResult> {
  let api = await getApiBySlug(db, input.apiSlug);
  if (!api) {
    api = await createApi(db, {
      slug: input.apiSlug,
      name: input.apiName ?? titleCase(input.apiSlug),
      description: input.description ?? null,
    });
  }

  const schema = inferColumns(input.rows);
  const collectionSlug = input.collectionSlug ?? DEFAULT_COLLECTION_SLUG;

  let collection = await getCollection(db, api.id, collectionSlug);
  if (!collection) {
    collection = await createCollection(db, {
      apiId: api.id,
      slug: collectionSlug,
      name: input.collectionName ?? titleCase(collectionSlug),
      schema,
    });
  } else {
    // Re-use existing collection but keep its schema in sync with newly
    // inferred columns.
    await setCollectionSchema(db, collection.id, schema);
    collection = { ...collection, schema };
  }

  const coerced = input.rows.map((row) => coerceRow(row, schema));
  const inserted = await insertRecords(db, collection.id, coerced);

  return { apiId: api.id, collectionId: collection.id, inserted, schema };
}
