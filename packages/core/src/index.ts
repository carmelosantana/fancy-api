export const version = "0.1.0";

export * from "./db/schema";
export * from "./db/client";
export * from "./ingest/infer";
export * from "./ingest/parse";
export * from "./query/params";
export * from "./query/build";
export * from "./auth/token";
export * from "./repo/apis";
export * from "./repo/records";
export * from "./repo/stats";
export * from "./ingest/pipeline";
export * from "./spec/types";
export * from "./spec/export";
export * from "./spec/import";
export * from "./spec/serialize";

// mcp/tools.ts is exported explicitly (not via `export *`): several of its
// pure handler names (listRecords, insertRecords, updateRecord,
// deleteRecord) intentionally mirror repo/records.ts function names for
// readability, which would otherwise create silently-dropped ambiguous
// exports from this barrel. `getToolDefinitions`/`assertWriteToken` are the
// primary public surface (what the Next.js /api/mcp route registers); the
// full handler set — including the colliding names — remains reachable via
// the `mcpTools` namespace.
export {
  assertWriteToken,
  getToolDefinitions,
  getRecord,
  queryRecords,
  insertRecord,
  type ToolContext,
  type ToolDefinition,
  type ListRecordsArgs,
  type GetRecordArgs,
  type QueryRecordsArgs,
  type InsertRecordArgs,
  type InsertRecordsArgs,
  type UpdateRecordArgs,
  type DeleteRecordArgs,
} from "./mcp/tools";
export * as mcpTools from "./mcp/tools";
