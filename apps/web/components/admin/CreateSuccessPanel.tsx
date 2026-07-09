"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/ui/CopyButton";
import { JsonView } from "@/components/ui/JsonView";
import { TokenRevealCard } from "@/components/admin/TokenRevealCard";

export type CreateResult =
  | {
      kind: "create";
      apiSlug: string;
      collectionSlug: string;
      inserted: number;
      writeToken?: string;
    }
  | { kind: "import"; apiSlug: string };

export function CreateSuccessPanel({ result }: { result: CreateResult }) {
  const [origin, setOrigin] = useState("");
  const [tryResult, setTryResult] = useState<unknown>(null);
  const [tryLoading, setTryLoading] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const base = `${origin}/api/${result.apiSlug}`;
  const listUrl = result.kind === "create" ? `${base}/${result.collectionSlug}` : null;

  async function tryIt() {
    if (!listUrl) return;
    setTryLoading(true);
    try {
      const res = await fetch(listUrl, { cache: "no-store" });
      setTryResult(await res.json());
    } catch (err) {
      setTryResult({ error: (err as Error).message });
    } finally {
      setTryLoading(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6" data-testid="create-success-panel">
      <div className="card flex flex-col items-center gap-2 p-8 text-center">
        <span className="text-4xl">🎉</span>
        <h2 className="text-xl font-bold text-white">
          {result.kind === "create" ? "Your API is live!" : "Import complete!"}
        </h2>
        <p className="text-sm text-white/55">
          {result.kind === "create"
            ? `Inserted ${result.inserted.toLocaleString()} record${result.inserted === 1 ? "" : "s"} into "${result.collectionSlug}".`
            : "Your declarative spec has been materialized into a live API."}
        </p>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs text-white/70">
          {base || `.../api/${result.apiSlug}`}
          {origin ? <CopyButton value={base} /> : null}
        </div>
      </div>

      {result.kind === "create" ? (
        <div className="card p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Endpoints</h3>
          <div className="space-y-2">
            {[
              { label: "List", url: `${base}/${result.collectionSlug}` },
              { label: "Random", url: `${base}/${result.collectionSlug}/random` },
              { label: "By id", url: `${base}/${result.collectionSlug}/1` },
              { label: "OpenAPI", url: `${base}/openapi.json` },
            ].map((ep) => (
              <div
                key={ep.label}
                data-testid={`endpoint-${ep.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="badge-pill shrink-0 !py-0.5 !text-[10px]">{ep.label}</span>
                  <span className="truncate font-mono text-xs text-white/60">{ep.url}</span>
                </div>
                <CopyButton value={ep.url} />
              </div>
            ))}
          </div>

          <button type="button" onClick={tryIt} disabled={tryLoading} className="btn-secondary mt-4">
            {tryLoading ? "Fetching…" : "▶ Try it live"}
          </button>
          {tryResult !== null ? <div className="mt-3"><JsonView data={tryResult} /></div> : null}
        </div>
      ) : null}

      {result.kind === "create" && result.writeToken ? (
        <TokenRevealCard apiSlug={result.apiSlug} origin={origin} token={result.writeToken} />
      ) : (
        <div className="card p-6 text-sm text-white/55">
          No write token yet. Rotate one from the API detail page whenever you want an AI agent to
          write to this API via MCP.
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/admin/apis/${result.apiSlug}`} className="btn-primary px-5 py-2.5">
          View API details →
        </Link>
        <Link href="/admin/new" className="btn-secondary px-5 py-2.5">
          Create another
        </Link>
      </div>
    </div>
  );
}
