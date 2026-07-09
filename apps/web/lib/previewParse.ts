/**
 * A lightweight, client-only heuristic table parser used purely for the
 * "before you submit" preview in the create wizard. It is intentionally
 * simple (no quoted-field escaping) — the real parsing happens server-side
 * via `@app/core`'s PapaParse-backed `parseTable`/`parseCsv`. This just has
 * to be good enough to show "yes, these look like your columns."
 */

export interface TablePreview {
  headers: string[];
  rows: string[][];
  rowCount: number;
  delimiter: string;
}

function detectDelimiter(line: string): string {
  const candidates: [string, number][] = [
    ["\t", (line.match(/\t/g) ?? []).length],
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["|", (line.match(/\|/g) ?? []).length],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ",";
}

export function previewTable(text: string, maxRows = 5): TablePreview | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) return null;

  const delimiter = detectDelimiter(lines[0] as string);
  const split = (line: string) => line.split(delimiter).map((cell) => cell.trim());

  const headers = split(lines[0] as string);
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, maxRows).map(split);

  return { headers, rows, rowCount: dataLines.length, delimiter };
}

/** Very rough per-column type guess, purely cosmetic for the preview badges. */
export function guessColumnType(values: string[]): "number" | "boolean" | "string" {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return "string";
  if (nonEmpty.every((v) => Number.isFinite(Number(v)))) return "number";
  if (nonEmpty.every((v) => ["true", "false", "yes", "no"].includes(v.trim().toLowerCase()))) {
    return "boolean";
  }
  return "string";
}
