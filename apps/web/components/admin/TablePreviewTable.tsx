import { guessColumnType, type TablePreview } from "@/lib/previewParse";

const TYPE_COLOR: Record<string, string> = {
  number: "text-cyan-300",
  boolean: "text-violet-300",
  string: "text-white/40",
};

export function TablePreviewTable({ preview }: { preview: TablePreview }) {
  const columns = preview.headers.map((header, i) => ({
    header,
    type: guessColumnType(preview.rows.map((r) => r[i] ?? "")),
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-white/40">
          preview · {preview.rowCount} row{preview.rowCount === 1 ? "" : "s"} detected
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-black/20">
              {columns.map((col) => (
                <th key={col.header} className="whitespace-nowrap px-3 py-2 font-mono font-medium text-white/70">
                  {col.header}
                  <span className={`ml-1.5 font-sans text-[10px] ${TYPE_COLOR[col.type]}`}>{col.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {columns.map((col, j) => (
                  <td key={col.header + j} className="whitespace-nowrap px-3 py-1.5 font-mono text-white/60">
                    {row[j] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
