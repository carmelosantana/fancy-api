"use client";

import { useEffect, useState } from "react";
import type { ColumnSchema } from "@app/core";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function RecordsTable({
  apiSlug,
  collectionSlug,
  schema,
  limit = 8,
}: {
  apiSlug: string;
  collectionSlug: string;
  schema: ColumnSchema[];
  limit?: number;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetch(`/api/${apiSlug}/${collectionSlug}?limit=${limit}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ data: Record<string, unknown>[]; meta: { total: number } }>;
      })
      .then((body) => {
        if (cancelled) return;
        setRows(body.data);
        setTotal(body.meta?.total ?? body.data.length);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [apiSlug, collectionSlug, limit]);

  const columns = schema.length > 0 ? schema.map((c) => c.name) : rows?.[0] ? Object.keys(rows[0]) : [];

  if (error) {
    return <p className="text-sm text-red-300">Couldn&apos;t load records: {error}</p>;
  }

  if (rows === null) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 rounded bg-white/5" />
        <div className="h-8 rounded bg-white/5" />
        <div className="h-8 rounded bg-white/5" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-white/40">No records in this collection yet.</p>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="whitespace-nowrap px-3 py-2 font-mono font-medium text-white/40">id</th>
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap px-3 py-2 font-mono font-medium text-white/70">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="border-b border-white/5 last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-white/30">{cell(row.id)}</td>
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-3 py-1.5 font-mono text-white/60">
                      {cell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {total !== null ? (
        <p className="mt-2 text-xs text-white/35">
          Showing {rows.length} of {total.toLocaleString()} record{total === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}
