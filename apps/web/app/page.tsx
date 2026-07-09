import Link from "next/link";
import { PublicNav } from "@/components/NavBar";
import { LiveQuoteWidget } from "@/components/landing/LiveQuoteWidget";
import { PlaygroundWidget } from "@/components/landing/PlaygroundWidget";

const STEPS = [
  {
    n: "01",
    title: "Paste",
    body: "Drop in a CSV, TSV, spreadsheet copy-paste, or a declarative YAML/JSON spec.",
  },
  {
    n: "02",
    title: "Generate",
    body: "Fancy infers your column types, builds a schema, and ingests every row.",
  },
  {
    n: "03",
    title: "Serve",
    body: "A live REST API — plus an MCP endpoint — is ready before your coffee's cold.",
  },
];

const FEATURES = [
  {
    icon: "🔎",
    title: "Real query syntax",
    body: "Filters, operators (_gt, _contains, _in…), sort, pagination, and free-text search — out of the box.",
  },
  {
    icon: "🤖",
    title: "MCP writes for agents",
    body: "Every API doubles as an MCP server. Point an agent at it with a bearer token and let it read & write.",
  },
  {
    icon: "🏠",
    title: "Self-host anywhere",
    body: "One SQLite file, one Next.js app. No managed backend, no vendor lock-in.",
  },
  {
    icon: "📜",
    title: "OSS · AGPL",
    body: "Fully open source. Export your API as a declarative spec and take it anywhere.",
  },
];

export default function Home() {
  return (
    <div>
      <PublicNav />

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <span className="badge-pill animate-fade-up text-white/60">
            <span aria-hidden="true">☕</span> Ship an API before your coffee&apos;s cold
          </span>
          <h1 className="max-w-3xl animate-fade-up text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl">
            Paste data.
            <br />
            Get a <span className="text-gradient">fancy</span> API.
          </h1>
          <p className="max-w-xl animate-fade-up text-lg text-white/60">
            Turn a spreadsheet, CSV, or JSON blob into a live, queryable REST API in minutes —
            with an MCP endpoint AI agents can read and write to.
          </p>
          <div className="flex animate-fade-up flex-wrap items-center justify-center gap-3">
            <Link href="/admin" className="btn-primary px-6 py-3 text-base">
              Start building →
            </Link>
            <a href="#playground" className="btn-secondary px-6 py-3 text-base">
              Try the live demo
            </a>
          </div>
        </section>

        {/* Live demo + playground */}
        <section id="playground" className="grid gap-6 pb-20 sm:grid-cols-2">
          <LiveQuoteWidget />
          <PlaygroundWidget />
        </section>

        {/* How it works */}
        <section className="border-t border-white/5 py-20">
          <h2 className="mb-10 text-center text-2xl font-bold text-white">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.n} className="card relative p-6">
                <span className="text-gradient text-4xl font-black">{step.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-white/55">{step.body}</p>
                {i < STEPS.length - 1 ? (
                  <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-2xl text-white/15 sm:block">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="border-t border-white/5 py-20">
          <h2 className="mb-10 text-center text-2xl font-bold text-white">Built for shipping fast</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5 transition hover:-translate-y-1 hover:shadow-glow">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA footer */}
        <section className="border-t border-white/5 py-20 text-center">
          <h2 className="text-2xl font-bold text-white">Your data wants to be an API.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
            Sign in to the dashboard and create your first one — it takes less time than this
            sentence took to read.
          </p>
          <Link href="/admin" className="btn-primary mt-6 inline-flex px-6 py-3 text-base">
            Open the dashboard →
          </Link>
        </section>

        <footer className="border-t border-white/5 py-8 text-center text-xs text-white/30">
          Fancy — a self-hostable, declarative API platform. Open source under AGPL.
        </footer>
      </main>
    </div>
  );
}
