"use client";

import { useCallback, useEffect, useState } from "react";

const ENDPOINT = "/api/hello-tony/quotes/random";
const REFRESH_MS = 6000;

type State =
  | { status: "loading" }
  | { status: "ready"; data: Record<string, unknown> }
  | { status: "missing" }
  | { status: "error"; message: string };

function pickText(data: Record<string, unknown>): { quote: string; author?: string } {
  const quoteKey = Object.keys(data).find((k) => /quote|text|body|content/i.test(k));
  const authorKey = Object.keys(data).find((k) => /author|by|name/i.test(k));
  const quote = quoteKey ? String(data[quoteKey]) : JSON.stringify(data);
  const author = authorKey ? String(data[authorKey]) : undefined;
  return { quote, author };
}

export function LiveQuoteWidget() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [spin, setSpin] = useState(false);

  const fetchQuote = useCallback(async () => {
    setSpin(true);
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });
      if (res.status === 404) {
        setState({ status: "missing" });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: `HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as { data?: Record<string, unknown> };
      if (!body.data) {
        setState({ status: "missing" });
        return;
      }
      setState({ status: "ready", data: body.data });
    } catch {
      setState({ status: "error", message: "Network error" });
    } finally {
      window.setTimeout(() => setSpin(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchQuote();
    const id = window.setInterval(fetchQuote, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchQuote]);

  return (
    <div className="card relative min-h-[220px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="badge-pill">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live demo API
        </span>
        <button
          type="button"
          onClick={fetchQuote}
          className="btn-secondary !px-3 !py-1.5 text-xs"
        >
          <span className={spin ? "inline-block animate-spin" : "inline-block"}>↻</span> New quote
        </button>
      </div>

      {state.status === "loading" ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-4/5 rounded bg-white/10" />
          <div className="h-4 w-3/5 rounded bg-white/10" />
          <div className="h-3 w-1/3 rounded bg-white/10" />
        </div>
      ) : state.status === "ready" ? (
        <blockquote key={JSON.stringify(state.data)} className="animate-fade-up">
          <p className="text-lg leading-snug text-white">“{pickText(state.data).quote}”</p>
          {pickText(state.data).author ? (
            <footer className="mt-3 text-sm text-white/50">— {pickText(state.data).author}</footer>
          ) : null}
        </blockquote>
      ) : state.status === "missing" ? (
        <div className="flex flex-col gap-2 text-sm text-white/50">
          <p>The live demo API (hello-tony/quotes) hasn&apos;t been seeded on this instance yet.</p>
          <p className="text-white/35">
            Seed the demo: <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">POST /api/_manage/apis</code>{" "}
            with slug <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">hello-tony</code> and a{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">quotes</code> collection.
          </p>
        </div>
      ) : (
        <p className="text-sm text-red-300">Couldn&apos;t load a quote right now ({state.message}).</p>
      )}

      <p className="mt-4 font-mono text-[11px] text-white/25">GET {ENDPOINT} · refreshes every {REFRESH_MS / 1000}s</p>
    </div>
  );
}
