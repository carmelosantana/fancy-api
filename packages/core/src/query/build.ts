import type { Row, Value } from "@libsql/client";
import type { Db } from "../db/client";
import type { ColumnSchema } from "../ingest/infer";
import type { Filter, QuerySpec } from "./params";

type SqlArg = Value | boolean;

interface ConditionSql {
  sql: string;
  args: SqlArg[];
}

const JSON_PATH_EXPR = "json_extract(data, '$.' || ?)";

function toSqlValue(value: unknown): SqlArg {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") {
    return value;
  }
  return String(value);
}

function buildCondition(filter: Filter): ConditionSql {
  const pathArg: SqlArg = filter.field;

  switch (filter.op) {
    case "eq":
      return { sql: `${JSON_PATH_EXPR} = ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "ne":
      return { sql: `${JSON_PATH_EXPR} != ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "gt":
      return { sql: `${JSON_PATH_EXPR} > ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "gte":
      return { sql: `${JSON_PATH_EXPR} >= ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "lt":
      return { sql: `${JSON_PATH_EXPR} < ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "lte":
      return { sql: `${JSON_PATH_EXPR} <= ?`, args: [pathArg, toSqlValue(filter.value)] };
    case "contains":
      return { sql: `${JSON_PATH_EXPR} LIKE ?`, args: [pathArg, `%${String(filter.value)}%`] };
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (values.length === 0) {
        // Empty IN-list matches nothing.
        return { sql: "0", args: [] };
      }
      return {
        sql: `${JSON_PATH_EXPR} IN (${values.map(() => "?").join(", ")})`,
        args: [pathArg, ...values.map(toSqlValue)],
      };
    }
    default:
      throw new Error(`Unsupported operator: ${String(filter.op)}`);
  }
}

function buildFilterSql(
  spec: QuerySpec,
  schema: ColumnSchema[],
): { sql: string; args: SqlArg[] } {
  const parts: string[] = [];
  const args: SqlArg[] = [];

  for (const filter of spec.filters) {
    const cond = buildCondition(filter);
    parts.push(cond.sql);
    args.push(...cond.args);
  }

  if (spec.q) {
    const stringColumns = schema.filter((c) => c.type === "string");
    if (stringColumns.length > 0) {
      const orParts: string[] = [];
      for (const col of stringColumns) {
        orParts.push(`${JSON_PATH_EXPR} LIKE ?`);
        args.push(col.name, `%${spec.q}%`);
      }
      parts.push(`(${orParts.join(" OR ")})`);
    }
  }

  return { sql: parts.join(" AND "), args };
}

function rowToRecord(row: Row): Record<string, unknown> {
  const data = JSON.parse(String(row.data)) as Record<string, unknown>;
  return { id: row.id, ...data };
}

export async function runQuery(
  db: Db,
  collectionId: number,
  spec: QuerySpec,
  schema: ColumnSchema[],
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const client = db.$client;
  const { sql: filterSql, args: filterArgs } = buildFilterSql(spec, schema);
  const whereClause = filterSql ? `AND ${filterSql}` : "";

  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as count FROM records WHERE collection_id = ? ${whereClause}`,
    args: [collectionId, ...filterArgs],
  });
  const total = Number(countResult.rows[0]?.count ?? 0);

  let orderSql = "ORDER BY seq ASC";
  const orderArgs: SqlArg[] = [];
  if (spec.random) {
    // `sort=random` — a fresh random ordering per request. Takes precedence over
    // any field sort (handy for "one random record" via ?sort=random&limit=1).
    orderSql = "ORDER BY RANDOM()";
  } else if (spec.sort.length > 0) {
    const parts = spec.sort.map((s) => {
      orderArgs.push(s.field);
      return `${JSON_PATH_EXPR} ${s.dir === "desc" ? "DESC" : "ASC"}`;
    });
    orderSql = `ORDER BY ${parts.join(", ")}`;
  }

  const dataResult = await client.execute({
    sql: `SELECT id, data FROM records WHERE collection_id = ? ${whereClause} ${orderSql} LIMIT ? OFFSET ?`,
    args: [collectionId, ...filterArgs, ...orderArgs, spec.limit, spec.offset],
  });

  return { data: dataResult.rows.map(rowToRecord), total };
}

export async function getById(
  db: Db,
  collectionId: number,
  id: number,
): Promise<Record<string, unknown> | null> {
  const client = db.$client;
  const result = await client.execute({
    sql: `SELECT id, data FROM records WHERE collection_id = ? AND id = ? LIMIT 1`,
    args: [collectionId, id],
  });
  const row = result.rows[0];
  return row ? rowToRecord(row) : null;
}

export async function randomRecord(
  db: Db,
  collectionId: number,
): Promise<Record<string, unknown> | null> {
  const client = db.$client;
  const result = await client.execute({
    sql: `SELECT id, data FROM records WHERE collection_id = ? ORDER BY RANDOM() LIMIT 1`,
    args: [collectionId],
  });
  const row = result.rows[0];
  return row ? rowToRecord(row) : null;
}
