"use client";

import { useEffect, useState } from "react";
import { JsonView } from "@/components/ui/JsonView";
import { CodeBlock } from "@/components/ui/CodeBlock";

const BASE = "/api/hello-tony/quotes";

export function PlaygroundWidget() {
  const [query, setQuery] = useState("limit=3&sort=-id");
  const [response, setResponse] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = query.trim() ? `${BASE}?${query.trim().replace(/^\?/, "")}` : BASE;
  const curl = `curl "${origin || "https://your-host"}${path}"`;

  async function send() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(path, { cache: "no-store" });
      setStatus(res.status);
      const body = await res.json().catch(() => ({ error: "Invalid JSON response" }));
      setResponse(body);
    } catch (err) {
      setStatus(0);
      setResponse({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Try the query syntax</h3>
        {status !== null ? (
          <span
            className={`badge-pill ${status >= 200 && status < 300 ? "text-emerald-300" : "text-amber-300"}`}
          >
            HTTP {status || "ERR"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm text-white/70">
          <span className="whitespace-nowrap text-white/30">{BASE}?</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="field_gt=1&sort=-id&limit=5"
            className="w-full bg-transparent py-2.5 text-white outline-none placeholder:text-white/25"
          />
        </div>
        <button type="button" onClick={send} disabled={loading} className="btn-primary sm:w-28">
          {loading ? "Sending…" : "Send ▸"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
