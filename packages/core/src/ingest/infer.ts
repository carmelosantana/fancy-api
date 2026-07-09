export type ColumnType = "string" | "number" | "boolean" | "date";

export interface ColumnSchema {
  name: string;
  type: ColumnType;
}

const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no"]);
const TRUE_VALUES = new Set(["true", "yes"]);

// YYYY-MM-DD optionally followed by a time component (T or space separated).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function isNumeric(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function isBoolean(value: string): boolean {
  return BOOLEAN_VALUES.has(value.trim().toLowerCase());
}

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value.trim());
}

export function inferColumns(rows: Record<string, string>[]): ColumnSchema[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }

  const columns: ColumnSchema[] = [];
  for (const name of keys) {
    const values = rows
      .map((row) => row[name])
      .filter((v): v is string => v !== undefined && v !== null && v.trim() !== "");

    columns.push({ name, type: inferColumnType(values) });
  }
  return columns;
}

function inferColumnType(values: string[]): ColumnType {
  if (values.length === 0) return "string";
  if (values.every(isNumeric)) return "number";
  if (values.every(isBoolean)) return "boolean";
  if (values.every(isIsoDate)) return "date";
  return "string";
}

export function coerceRow(
  row: Record<string, string>,
  schema: ColumnSchema[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const column of schema) {
    const raw = row[column.name];
    if (raw === undefined || raw === null || raw.trim() === "") {
      result[column.name] = null;
      continue;
    }

    switch (column.type) {
      case "number":
        result[column.name] = Number(raw);
        break;
      case "boolean":
        result[column.name] = TRUE_VALUES.has(raw.trim().toLowerCase());
        break;
      case "date":
        result[column.name] = raw.trim();
        break;
      case "string":
      default:
        result[column.name] = raw;
        break;
    }
  }
  return result;
}
