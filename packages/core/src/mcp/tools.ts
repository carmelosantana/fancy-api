import { z } from "zod";
import type { Db } from "../db/client";
import { verifyToken } from "../auth/token";
import { getApiBySlug, getCollection, type ApiRow } from "../repo/apis";
import {
  insertRecords as repoInsertRecords,
  updateRecord as repoUpdateRecord,
  deleteRecord as repoDeleteRecord,
  listRecords as repoListRecords,
} from "../repo/records";
import { getById, runQuery } from "../query/build";
import { parseQuery } from "../query/params";

/**
 * Throws if the api requires a write token and the supplied token is
 * missing or does not match the stored hash. No-op if the api has no
 * write token configured (open write access).
 */
export function assertWriteToken(api: ApiRow, token: string | undefined): void {
  if (!api.writeTokenHash) return;
  if (!token || !verifyToken(token, api.writeTokenHash)) {
    throw new Error("Invalid or missing write token");
  }
}

async function resolveCollection(db: Db, apiSlug: string, collectionSlug: string) {
  const api = await getApiBySlug(db, apiSlug);
  if (!api) throw new Error(`Api not found: ${apiSlug}`);
  const collection = await getCollection(db, api.id, collectionSlug);
  if (!collection) throw new Error(`Collection not found: ${collectionSlug}`);
  return { api, collection };
}

// ---------------------------------------------------------------------------
// Pure handlers: (db, args) -> data. No token checks here — token checks
// happen in the tool-definition wrappers below (see getToolDefinitions),
// which have access to the caller's ctx.
// ---------------------------------------------------------------------------

export interface ListRecordsArgs {
  apiSlug: string;
  collection: string;
  limit?: number;
  offset?: number;
}

// `list_records` requires no write token, so an unbounded `limit` would let
// any MCP client page through an entire (possibly huge) collection in one
// call. Mirrors the REST layer's cap (`query/params.ts`'s DEFAULT_LIMIT /
// MAX_LIMIT of 25 / 100).
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

function clampListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIST_LIMIT);
}

export async function listRecords(db: Db, args: ListRecordsArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const limit = clampListLimit(args.limit);
  return repoListRecords(db, collection.id, { limit, offset: args.offset });
}

export interface GetRecordArgs {
  apiSlug: string;
  collection: string;
  id: number;
}

export async function getRecord(db: Db, args: GetRecordArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const record = await getById(db, collection.id, args.id);
  if (!record) throw new Error(`Record not found: ${args.id}`);
  return record;
}

export interface QueryRecordsArgs {
  apiSlug: string;
  collection: string;
  query?: Record<string, string>;
}

export async function queryRecords(db: Db, args: QueryRecordsArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const params = new URLSearchParams(args.query ?? {});
  const spec = parseQuery(params, collection.schema);
  return runQuery(db, collection.id, spec, collection.schema);
}

export interface InsertRecordArgs {
  apiSlug: string;
  collection: string;
  record: Record<string, unknown>;
}

export async function insertRecord(db: Db, args: InsertRecordArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  await repoInsertRecords(db, collection.id, [args.record]);
  const { total } = await repoListRecords(db, collection.id, { limit: 1, offset: 0 });
  const { data } = await repoListRecords(db, collection.id, {
    limit: 1,
    offset: Math.max(total - 1, 0),
  });
  return data[0] ?? null;
}

export interface InsertRecordsArgs {
  apiSlug: string;
  collection: string;
  records: Record<string, unknown>[];
}

export async function insertRecords(db: Db, args: InsertRecordsArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const inserted = await repoInsertRecords(db, collection.id, args.records);
  return { inserted };
}

export interface UpdateRecordArgs {
  apiSlug: string;
  collection: string;
  id: number;
  patch: Record<string, unknown>;
}

export async function updateRecord(db: Db, args: UpdateRecordArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const updated = await repoUpdateRecord(db, collection.id, args.id, args.patch);
  if (!updated) throw new Error(`Record not found: ${args.id}`);
  return updated;
}

export interface DeleteRecordArgs {
  apiSlug: string;
  collection: string;
  id: number;
}

export async function deleteRecord(db: Db, args: DeleteRecordArgs) {
  const { collection } = await resolveCollection(db, args.apiSlug, args.collection);
  const deleted = await repoDeleteRecord(db, collection.id, args.id);
  if (!deleted) throw new Error(`Record not found: ${args.id}`);
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Tool definitions: what the Next.js /api/mcp route registers with the MCP
// SDK. Write tools resolve the api and enforce the write token before
// delegating to the pure handler above.
// ---------------------------------------------------------------------------

const listRecordsInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

const getRecordInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  id: z.number().int(),
});

const queryRecordsInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  query: z.record(z.string(), z.string()).optional(),
});

const insertRecordInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  record: z.record(z.string(), z.unknown()),
});

const insertRecordsInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  records: z.array(z.record(z.string(), z.unknown())),
});

const updateRecordInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  id: z.number().int(),
  patch: z.record(z.string(), z.unknown()),
});

const deleteRecordInput = z.object({
  apiSlug: z.string(),
  collection: z.string(),
  id: z.number().int(),
});

export interface ToolContext {
  token?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (db: Db, args: any, ctx: ToolContext) => Promise<unknown>;
}

async function requireWriteAccess(db: Db, apiSlug: string, token: string | undefined): Promise<void> {
  const api = await getApiBySlug(db, apiSlug);
  if (!api) throw new Error(`Api not found: ${apiSlug}`);
  assertWriteToken(api, token);
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "list_records",
      description: "List records in a collection, paginated. No token required.",
      inputSchema: listRecordsInput,
      handler: async (db, args) => listRecords(db, args),
    },
    {
      name: "get_record",
      description: "Get a single record by id. No token required.",
      inputSchema: getRecordInput,
      handler: async (db, args) => getRecord(db, args),
    },
    {
      name: "query_records",
      description: "Query records with filters, sort, and free-text search. No token required.",
      inputSchema: queryRecordsInput,
      handler: async (db, args) => queryRecords(db, args),
    },
    {
      name: "insert_record",
      description: "Insert a single record. Requires the api's write token if one is configured.",
      inputSchema: insertRecordInput,
      handler: async (db, args, ctx) => {
        await requireWriteAccess(db, args.apiSlug, ctx.token);
        return insertRecord(db, args);
      },
    },
    {
      name: "insert_records",
      description: "Insert multiple records. Requires the api's write token if one is configured.",
      inputSchema: insertRecordsInput,
      handler: async (db, args, ctx) => {
        await requireWriteAccess(db, args.apiSlug, ctx.token);
        return insertRecords(db, args);
      },
    },
    {
      name: "update_record",
      description:
        "Shallow-merge a patch into a record by id. Requires the api's write token if one is configured.",
      inputSchema: updateRecordInput,
      handler: async (db, args, ctx) => {
        await requireWriteAccess(db, args.apiSlug, ctx.token);
        return updateRecord(db, args);
      },
    },
    {
      name: "delete_record",
      description: "Delete a record by id. Requires the api's write token if one is configured.",
      inputSchema: deleteRecordInput,
      handler: async (db, args, ctx) => {
        await requireWriteAccess(db, args.apiSlug, ctx.token);
        return deleteRecord(db, args);
      },
    },
  ];
}
