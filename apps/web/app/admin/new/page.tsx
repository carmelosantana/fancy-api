"use client";

import { useMemo, useRef, useState } from "react";
import { AdminNav } from "@/components/NavBar";
import { TablePreviewTable } from "@/components/admin/TablePreviewTable";
import { CreateSuccessPanel, type CreateResult } from "@/components/admin/CreateSuccessPanel";
import { previewTable } from "@/lib/previewParse";
import { slugify } from "@/lib/slug";
import { fireConfetti } from "@/lib/confetti";

type TabId = "paste" | "upload" | "csv" | "import";

const TABS: { id: TabId; label: string }[] = [
  { id: "paste", label: "Paste table" },
  { id: "upload", label: "Upload CSV" },
  { id: "csv", label: "Paste CSV" },
  { id: "import", label: "Import spec" },
];

const SAMPLE_TABLE = `title\tauthor\tyear\nThe Left Hand of Darkness\tUrsula K. Le Guin\t1969\nDune\tFrank Herbert\t1965`;

export default function NewApiPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");

  const [tab, setTab] = useState<TabId>("paste");
  const [tableText, setTableText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    setUploadedName(file.name);
    const text = await file.text();
    setCsvText(text);
  }

  const activeText = tab === "paste" ? tableText : tab === "csv" || tab === "upload" ? csvText : "";
  const preview = useMemo(() => (activeText.trim() ? previewTable(activeText) : null), [activeText]);

  const needsNameSlug = tab !== "import";
  const canSubmit = needsNameSlug
    ? Boolean(slug.trim()) && Boolean(name.trim()) && Boolean(activeText.trim())
    : Boolean(importText.trim());

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (tab === "import") {
        const res = await fetch("/api/_manage/import", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: importText,
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; apiSlug?: string };
        if (!res.ok) {
          setError(body.error ?? "Import failed");
          return;
        }
        setResult({ kind: "import", apiSlug: body.apiSlug as string });
        fireConfetti();
        return;
      }

      const payload: Record<string, unknown> = {
        apiSlug: slug.trim(),
        apiName: name.trim(),
      };
      if (description.trim()) payload.description = description.trim();
      if (tab === "paste") payload.tableText = tableText;
      else payload.csvText = csvText;

      const res = await fetch("/api/_manage/apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        apiSlug?: string;
        collectionSlug?: string;
        inserted?: number;
        writeToken?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      setResult({
        kind: "create",
        apiSlug: body.apiSlug as string,
        collectionSlug: body.collectionSlug as string,
        inserted: body.inserted ?? 0,
        writeToken: body.writeToken,
      });
      fireConfetti();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AdminNav title="new" back={{ href: "/admin", label: "Dashboard" }} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {result ? (
          <CreateSuccessPanel result={result} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Create a new API</h1>
            <p className="mt-1 text-sm text-white/50">
              Give it a name, then hand over some data. We&apos;ll infer the schema and stand up a
              live API.
            </p>

            {tab !== "import" ? (
              <div className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">Name</label>
                  <input
                    className="input"
                    placeholder="Sci-fi Books"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    data-testid="api-name-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">Slug</label>
                  <input
                    className="input font-mono"
                    placeholder="scifi-books"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    data-testid="api-slug-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">
                    Description <span className="text-white/25">(optional)</span>
                  </label>
                  <input
                    className="input"
                    placeholder="A tiny catalog of favorite sci-fi novels"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === t.id ? "bg-white text-black shadow" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="card mt-4 p-6">
              {tab === "paste" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wide text-white/40">
                      Paste a table (tab or comma separated, first row = headers)
                    </label>
                    <button
                      type="button"
                      className="text-xs text-white/40 underline decoration-dotted hover:text-white/70"
                      onClick={() => setTableText(SAMPLE_TABLE)}
                    >
                      Use sample data
                    </button>
                  </div>
                  <textarea
                    className="input h-40 font-mono"
                    placeholder={SAMPLE_TABLE}
                    value={tableText}
                    onChange={(e) => setTableText(e.target.value)}
                    data-testid="table-paste-textarea"
                  />
                </div>
              ) : tab === "upload" ? (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">
                    Upload a CSV file
                  </label>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center transition hover:border-white/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="text-2xl">📄</span>
                    <p className="text-sm text-white/60">
                      {uploadedName ?? "Click to choose a .csv file"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => onFileSelected(e.target.files?.[0])}
                    />
                  </div>
                </div>
              ) : tab === "csv" ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">
                    Paste CSV text
                  </label>
                  <textarea
                    className="input h-40 font-mono"
                    placeholder="title,author,year&#10;Dune,Frank Herbert,1965"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/40">
                    Paste a declarative spec (YAML or JSON) — its own slug/name are used
                  </label>
                  <textarea
                    className="input h-48 font-mono"
                    placeholder={"slug: scifi-books\nname: Sci-fi Books\ncollections:\n  - slug: books\n    name: Books\n    schema: [...]\n    records: [...]"}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <p className="text-xs text-white/35">
                    This is what <code className="rounded bg-white/10 px-1 py-0.5 font-mono">GET /api/_manage/apis/[slug]/export</code>{" "}
                    produces — round-trip it here to restore or clone an API.
                  </p>
                </div>
              )}

              {preview ? (
                <div className="mt-4">
                  <TablePreviewTable preview={preview} />
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || submitting}
                className="btn-primary px-6 py-2.5"
                data-testid="create-api-submit"
              >
                {submitting ? "Creating…" : "Create API 🚀"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
