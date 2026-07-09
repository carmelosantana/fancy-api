"use client";

import { useEffect, useState } from "react";
import type { ColumnSchema, Op } from "@app/core";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { JsonView } from "@/components/ui/JsonView";

interface FilterRow {
  id: number;
  field: string;
  op: Op;
  value: string;
}

const STRING_OPS: Op[] = ["eq", "ne", "contains", "in"];
const OTHER_OPS: Op[] = ["eq", "ne", "gt", "gte", "lt", "lte", "in"];

let rowId = 0;

export function FilterPlayground({
  apiSlug,
  collectionSlug,
  schema,
}: {
  apiSlug: string;
  collectionSlug: string;
  schema: ColumnSchema[];
}) {
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState("");
  const [response, setResponse] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function opsFor(field: string): Op[] {
    const col = schema.find((c) => c.name === field);
    return col?.type === "string" || !col ? STRING_OPS : OTHER_OPS;
  }

  function addFilter() {
    const field = schema[0]?.name ?? "";
    setFilters((rows) => [...rows, { id: rowId++, field, op: "eq", value: "" }]);
  }

  function updateFilter(id: number, patch: Partial<FilterRow>) {
    setFilters((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeFilter(id: number) {
    setFilters((rows) => rows.filter((r) => r.id !== id));
  }

  function buildQueryString(): string {
    const params = new URLSearchParams();
    for (const f of filters) {
      if (!f.field || f.value.trim() === "") continue;
      const key = f.op === "eq" ? f.field : `${f.field}_${f.op}`;
      params.append(key, f.value);
    }
    if (sortField) params.set("sort", `${sortDir === "desc" ? "-" : ""}${sortField}`);
    if (limit) params.set("limit", String(limit));
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }

  const qs = buildQueryString();
  const path = `/api/${apiSlug}/${collectionSlug}${qs ? `?${qs}` : ""}`;
  const curl = `curl "${(origin || "https://your-host") + path}"`;

  async function send() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(path, { cache: "no-store" });
      setStatus(res.status);
      setResponse(await res.json().catch(() => ({ error: "Invalid JSON" })));
    } catch (err) {
      setStatus(0);
      setResponse({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {filters.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto min-w-[8rem]"
              value={f.field}
              onChange={(e) => updateFilter(f.id, { field: e.target.value, op: "eq" })}
            >
              {schema.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input w-auto min-w-[7rem]"
              value={f.op}
              onChange={(e) => updateFilter(f.id, { op: e.target.value as Op })}
            >
              {opsFor(f.field).map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <input
              className="input flex-1 min-w-[8rem]"
              placeholder="value"
              value={f.value}
              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeFilter(f.id)}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-white/40 transition hover:bg-white/5 hover:text-red-300"
              aria-label="Remove filter"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addFilter} className="btn-secondary !px-3 !py-1.5 text-xs">
          + Add filter
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-white/40">sort</span>
        <select className="input w-auto" value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="">none</option>
          {schema.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
          disabled={!sortField}
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <span className="ml-2 text-white/40">limit</span>
        <input
          type="number"
          min={1}
          max={100}
          className="input w-20"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 10)}
        />
        <span className="ml-2 text-white/40">q</span>
        <input
          className="input w-32 flex-1"
          placeholder="free-text search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={send} disabled={loading} className="btn-primary">
          {loading ? "Sending…" : "Send ▸"}
        </button>
        {status !== null ? (
          <span className={`badge-pill ${status >= 200 && status < 300 ? "text-emerald-300" : "text-amber-300"}`}>
            HTTP {status || "ERR"}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CodeBlock label="curl" code={curl} />
        {response !== null ? (
          <JsonView data={response} />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/30">
            Response appears here
          </div>
        )}
      </div>
    </div>
  );
}
