import type { ColumnSchema, ColumnType } from "../ingest/infer";

export type Op = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";

export interface Filter {
  field: string;
  op: Op;
  value: unknown;
}

export interface QuerySpec {
  filters: Filter[];
  sort: { field: string; dir: "asc" | "desc" }[];
  limit: number;
  offset: number;
  q?: string;
}

const RESERVED_PARAMS = new Set(["sort", "limit", "offset", "q"]);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const SUFFIX_RE = /^(.+)_(gt|gte|lt|lte|ne|contains|in)$/;

const TRUE_VALUES = new Set(["true", "yes"]);
const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no"]);

function coerceScalar(raw: string, type: ColumnType): unknown {
  const trimmed = raw.trim();
  if (type === "number") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }
  if (type === "boolean") {
    const lower = trimmed.toLowerCase();
    if (BOOLEAN_VALUES.has(lower)) return TRUE_VALUES.has(lower);
    return trimmed;
  }
  // date and string are compared as-is (ISO date strings sort/compare correctly as text)
  return trimmed;
}

export function parseQuery(params: URLSearchParams, schema: ColumnSchema[]): QuerySpec {
  const schemaByName = new Map(schema.map((c) => [c.name, c]));

  const spec: QuerySpec = {
    filters: [],
    sort: [],
    limit: DEFAULT_LIMIT,
    offset: 0,
  };

  const sortParam = params.get("sort");
  if (sortParam) {
    spec.sort = sortParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) =>
        s.startsWith("-")
          ? { field: s.slice(1), dir: "desc" as const }
          : { field: s, dir: "asc" as const },
      )
      .filter((s) => schemaByName.has(s.field));
  }

  const limitParam = params.get("limit");
  if (limitParam !== null) {
    const n = Number(limitParam);
    if (Number.isFinite(n) && n > 0) {
      spec.limit = Math.min(Math.floor(n), MAX_LIMIT);
    }
  }

  const offsetParam = params.get("offset");
  if (offsetParam !== null) {
    const n = Number(offsetParam);
    if (Number.isFinite(n) && n >= 0) {
      spec.offset = Math.floor(n);
    }
  }

  const qParam = params.get("q");
  if (qParam) {
    spec.q = qParam;
  }

  for (const [key, rawValue] of params.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;

    let field = key;
    let op: Op = "eq";

    const match = key.match(SUFFIX_RE);
    if (match) {
      field = match[1] as string;
      op = match[2] as Op;
    }

    const column = schemaByName.get(field);
    if (!column) continue; // unknown field: ignore silently

    const value =
      op === "in"
        ? rawValue.split(",").map((v) => coerceScalar(v, column.type))
        : coerceScalar(rawValue, column.type);

    spec.filters.push({ field, op, value });
  }

  return spec;
}
