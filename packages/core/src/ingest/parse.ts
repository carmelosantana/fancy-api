import Papa from "papaparse";

export function parseTable(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [",", "\t", ";", "|"],
    transform: (value: string) => (typeof value === "string" ? value.trim() : value),
    transformHeader: (header: string) => header.trim(),
  });

  return result.data;
}

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
    transform: (value: string) => (typeof value === "string" ? value.trim() : value),
    transformHeader: (header: string) => header.trim(),
  });

  return result.data;
}
