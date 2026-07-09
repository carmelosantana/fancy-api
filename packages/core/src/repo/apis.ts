import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { apis, collections, records } from "../db/schema";
import type { ColumnSchema } from "../ingest/infer";

export interface ApiRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  readKey: string | null;
  writeTokenHash: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionRow {
  id: number;
  apiId: number;
  slug: string;
  name: string;
  schema: ColumnSchema[];
  createdAt: number;
  updatedAt: number;
}

function toApiRow(row: typeof apis.$inferSelect): ApiRow {
  return {
    ...row,
    config: JSON.parse(row.config) as Record<string, unknown>,
  };
}

function toCollectionRow(row: typeof collections.$inferSelect): CollectionRow {
  return {
    ...row,
    schema: JSON.parse(row.schema) as ColumnSchema[],
  };
}

export interface CreateApiInput {
  slug: string;
  name: string;
  description?: string | null;
  config?: object;
  readKey?: string | null;
  writeTokenHash?: string | null;
}

export async function createApi(db: Db, input: CreateApiInput): Promise<ApiRow> {
  const now = Date.now();
  const result = await db.insert(apis).values({
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    config: JSON.stringify(input.config ?? {}),
    readKey: input.readKey ?? null,
    writeTokenHash: input.writeTokenHash ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const id = Number(result.lastInsertRowid);
  const created = await getApiById(db, id);
  if (!created) throw new Error(`Failed to create api ${input.slug}`);
  return created;
}

async function getApiById(db: Db, id: number): Promise<ApiRow | null> {
  const rows = await db.select().from(apis).where(eq(apis.id, id));
  const row = rows[0];
  return row ? toApiRow(row) : null;
}

export async function getApiBySlug(db: Db, slug: string): Promise<ApiRow | null> {
  const rows = await db.select().from(apis).where(eq(apis.slug, slug));
  const row = rows[0];
  return row ? toApiRow(row) : null;
}

export async function listApis(db: Db): Promise<ApiRow[]> {
  const rows = await db.select().from(apis);
  return rows.map(toApiRow);
}

export interface UpdateApiPatch {
  name?: string;
  description?: string | null;
  config?: object;
  readKey?: string | null;
  writeTokenHash?: string | null;
}

export async function updateApi(db: Db, slug: string, patch: UpdateApiPatch): Promise<ApiRow> {
  const existing = await getApiBySlug(db, slug);
  if (!existing) throw new Error(`Api not found: ${slug}`);

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.config !== undefined) update.config = JSON.stringify(patch.config);
  if (patch.readKey !== undefined) update.readKey = patch.readKey;
  if (patch.writeTokenHash !== undefined) update.writeTokenHash = patch.writeTokenHash;

  await db.update(apis).set(update).where(eq(apis.id, existing.id));

  const updated = await getApiById(db, existing.id);
  if (!updated) throw new Error(`Api not found after update: ${slug}`);
  return updated;
}

export async function deleteApi(db: Db, slug: string): Promise<void> {
  const existing = await getApiBySlug(db, slug);
  if (!existing) return;

  const cols = await db.select().from(collections).where(eq(collections.apiId, existing.id));
  const collectionIds = cols.map((c) => c.id);

  if (collectionIds.length > 0) {
    await db.delete(records).where(inArray(records.collectionId, collectionIds));
    await db.delete(collections).where(eq(collections.apiId, existing.id));
  }

  await db.delete(apis).where(eq(apis.id, existing.id));
}

export interface CreateCollectionInput {
  apiId: number;
  slug: string;
  name: string;
  schema: ColumnSchema[];
}

export async function createCollection(
  db: Db,
  input: CreateCollectionInput,
): Promise<CollectionRow> {
  const now = Date.now();
  const result = await db.insert(collections).values({
    apiId: input.apiId,
    slug: input.slug,
    name: input.name,
    schema: JSON.stringify(input.schema),
    createdAt: now,
    updatedAt: now,
  });

  const id = Number(result.lastInsertRowid);
  const rows = await db.select().from(collections).where(eq(collections.id, id));
  const row = rows[0];
  if (!row) throw new Error(`Failed to create collection ${input.slug}`);
  return toCollectionRow(row);
}

export async function getCollection(
  db: Db,
  apiId: number,
  slug: string,
): Promise<CollectionRow | null> {
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.apiId, apiId), eq(collections.slug, slug)));
  const row = rows[0];
  return row ? toCollectionRow(row) : null;
}

export async function listCollections(db: Db, apiId: number): Promise<CollectionRow[]> {
  const rows = await db.select().from(collections).where(eq(collections.apiId, apiId));
  return rows.map(toCollectionRow);
}

export async function setCollectionSchema(
  db: Db,
  collectionId: number,
  schema: ColumnSchema[],
): Promise<void> {
  await db
    .update(collections)
    .set({ schema: JSON.stringify(schema), updatedAt: Date.now() })
    .where(eq(collections.id, collectionId));
}
