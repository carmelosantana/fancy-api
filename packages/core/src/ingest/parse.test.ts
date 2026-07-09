import { describe, expect, test } from "vitest";
import { parseTable, parseCsv } from "./parse";

describe("parseTable", () => {
  test("parses CSV with header", () => {
    const text = "name,age\nAda,36\nGrace,85\n";
    expect(parseTable(text)).toEqual([
      { name: "Ada", age: "36" },
      { name: "Grace", age: "85" },
    ]);
  });

  test("parses TSV paste (tab-delimited)", () => {
    const text = "name\tage\nAda\t36\nGrace\t85\n";
    expect(parseTable(text)).toEqual([
      { name: "Ada", age: "36" },
      { name: "Grace", age: "85" },
    ]);
  });

  test("handles quoted field containing a comma", () => {
    const text = 'name,bio\nAda,"Countess, mathematician"\n';
    expect(parseTable(text)).toEqual([{ name: "Ada", bio: "Countess, mathematician" }]);
  });
});

describe("parseCsv", () => {
  test("parses comma-delimited CSV", () => {
    const text = "name,age\nAda,36\n";
    expect(parseCsv(text)).toEqual([{ name: "Ada", age: "36" }]);
  });

  test("handles quoted field containing a comma", () => {
    const text = 'name,bio\nAda,"Countess, mathematician"\n';
    expect(parseCsv(text)).toEqual([{ name: "Ada", bio: "Countess, mathematician" }]);
  });
});
