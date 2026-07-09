import { describe, expect, test } from "vitest";
import { inferColumns, coerceRow } from "./infer";

describe("inferColumns", () => {
  test("infers number column", () => {
    const rows = [{ age: "1" }, { age: "2.5" }, { age: "-3" }];
    expect(inferColumns(rows)).toEqual([{ name: "age", type: "number" }]);
  });

  test("infers boolean column from yes/no", () => {
    const rows = [{ active: "yes" }, { active: "no" }, { active: "Yes" }];
    expect(inferColumns(rows)).toEqual([{ name: "active", type: "boolean" }]);
  });

  test("infers boolean column from true/false", () => {
    const rows = [{ active: "true" }, { active: "False" }];
    expect(inferColumns(rows)).toEqual([{ name: "active", type: "boolean" }]);
  });

  test("infers ISO date column", () => {
    const rows = [{ published: "2024-01-05" }, { published: "2023-12-31T10:00:00Z" }];
    expect(inferColumns(rows)).toEqual([{ name: "published", type: "date" }]);
  });

  test("mixed values fall back to string", () => {
    const rows = [{ misc: "42" }, { misc: "hello" }];
    expect(inferColumns(rows)).toEqual([{ name: "misc", type: "string" }]);
  });

  test("empty column defaults to string", () => {
    const rows = [{ note: "" }, { note: "" }];
    expect(inferColumns(rows)).toEqual([{ name: "note", type: "string" }]);
  });

  test("infers union of keys across rows", () => {
    const rows: Record<string, string>[] = [{ a: "1" }, { b: "2" }];
    const cols = inferColumns(rows).sort((x, y) => x.name.localeCompare(y.name));
    expect(cols).toEqual([
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ]);
  });
});

describe("coerceRow", () => {
  test("yields real number and boolean values", () => {
    const schema = [
      { name: "age", type: "number" as const },
      { name: "active", type: "boolean" as const },
      { name: "name", type: "string" as const },
      { name: "published", type: "date" as const },
    ];
    const row = { age: "42", active: "yes", name: "Ada", published: "2024-01-05" };
    const coerced = coerceRow(row, schema);
    expect(coerced.age).toBe(42);
    expect(typeof coerced.age).toBe("number");
    expect(coerced.active).toBe(true);
    expect(typeof coerced.active).toBe("boolean");
    expect(coerced.name).toBe("Ada");
    expect(coerced.published).toBe("2024-01-05");
  });

  test("missing/empty cells become null", () => {
    const schema = [{ name: "age", type: "number" as const }];
    expect(coerceRow({ age: "" }, schema)).toEqual({ age: null });
    expect(coerceRow({}, schema)).toEqual({ age: null });
  });
});
