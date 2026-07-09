"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiStats, ColumnSchema } from "@app/core";
import { AdminNav } from "@/components/NavBar";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatCounter } from "@/components/ui/StatCounter";
import { BadgeRow } from "@/components/ui/Badge";
import { McpConfigSnippet } from "@/components/McpConfigSnippet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TokenRevealCard } from "@/components/admin/TokenRevealCard";
import { FilterPlayground } from "@/components/admin/FilterPlayground";
import { RecordsTable } from "@/components/admin/RecordsTable";
import { milestonesFor } from "@/lib/milestones";

export interface ApiDetailData {
  slug: string;
  name: string;
  description: string | null;
  hasWriteToken: boolean;
  hasReadKey: boolean;
}

export interface CollectionData {
  slug: string;
  name: string;
  schema: ColumnSchema[];
}

function Sparkline({ data }: { data: ApiStats["requestsByDay"] }) {
  const last7 = data.slice(-7);
  if (last7.length === 0) {
    return <p className="text-xs text-white/30">No requests logged yet.</p>;
  }
  const max = Math.max(1, ...last7.map((d) => d.count));
  return (
    <div className="flex h-16 items-end gap-1.5">
      {last7.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
          <div
            className="w-full rounded-t bg-gradient-to-t from-brand-violet to-brand-cyan transition-all"
            style={{ height: `${Math.max(4, (d.count / max) * 48)}px` }}
          />
          <span className="text-[9px] text-white/25">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function ApiDetailClient({
  api,
  collections,
  stats,
}: {
  api: ApiDetailData;
  collections: CollectionData[];
  stats: ApiStats;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [activeCollection, setActiveCollection] = useState(collections[0]?.slug ?? "");

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const collection = collections.find((c) => c.slug === activeCollection) ?? collections[0];
  const base = `${origin}/api/${api.slug}`;

  const milestones = useMemo(
    () =>
      milestonesFor({
        totalRecords: stats.totalRecords,
        totalRequests: stats.totalRequests,
        collections: collections.length,
      }),
    [stats, collections.length],
  );

  async function rotateToken() {
    setRotating(true);
    setRotateError(null);
    try {
      const res = await fetch(`/api/_manage/apis/${api.slug}/rotate-token`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; writeToken?: string };
      if (!res.ok || !body.writeToken) {
        setRotateError(body.error ?? "Rotation failed");
        return;
      }
      setNewToken(body.writeToken);
      setRotateOpen(false);
    } catch {
      setRotateError("Couldn't reach the server.");
    } finally {
      setRotating(false);
    }
  }

  async function deleteApi() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/_manage/apis/${api.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(body.error ?? "Delete failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setDeleteError("Couldn't reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <AdminNav title={api.slug} back={{ href: "/admin", label: "Dashboard" }} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{api.name}</h1>
              <div className="mt-1 flex items-center gap-2 font-mono text-sm text-white/45">
                {base || `/api/${api.slug}`}
                {origin ? <CopyButton value={base} /> : null}
              </div>
              {api.description ? <p className="mt-2 max-w-xl text-sm text-white/55">{api.description}</p> : null}
            </div>
            <button type="button" onClick={() => setDeleteOpen(true)} className="btn-danger">
              Delete API
            </button>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-white">
                  <StatCounter value={stats.totalRecords} />
                </div>
                <div className="text-[11px] uppercase tracking-wide text-white/35">records</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  <StatCounter value={stats.totalRequests} />
                </div>
                <div className="text-[11px] uppercase tracking-wide text-white/35">requests served</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{collections.length}</div>
                <div className="text-[11px] uppercase tracking-wide text-white/35">collections</div>
              </div>
            </div>
            <div>
              <Sparkline data={stats.requestsByDay} />
            </div>
          </div>

          <div className="mt-4 border-t border-white/5 pt-4">
            <BadgeRow milestones={milestones} />
          </div>
        </div>

        {newToken ? (
          <div className="mt-6">
            <TokenRevealCard apiSlug={api.slug} origin={origin} token={newToken} note="rotated" />
            <button type="button" className="btn-secondary mt-3" onClick={() => setNewToken(null)}>
              Done
            </button>
          </div>
        ) : null}

        {collections.length === 0 ? (
          <div className="card mt-6 p-6 text-sm text-white/55">
            This API has no collections yet.
          </div>
        ) : (
          <>
            {/* Collection picker */}
            {collections.length > 1 ? (
              <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {collections.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setActiveCollection(c.slug)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      activeCollection === c.slug
                        ? "bg-white text-black shadow"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}

            {collection ? (
              <>
                {/* Endpoints */}
                <section className="card mt-6 p-6">
                  <h2 className="mb-3 text-sm font-semibold text-white">Endpoints</h2>
                  <div className="space-y-2">
                    {[
                      { label: "List", url: `${base}/${collection.slug}` },
                      { label: "Random", url: `${base}/${collection.slug}/random` },
                      { label: "By id", url: `${base}/${collection.slug}/1` },
                      { label: "OpenAPI", url: `${base}/openapi.json` },
                    ].map((ep) => (
                      <div
                        key={ep.label}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="badge-pill shrink-0 !py-0.5 !text-[10px]">{ep.label}</span>
                          <span className="truncate font-mono text-xs text-white/60">{ep.url}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ep.label === "OpenAPI" ? (
                            <a href={`/api/${api.slug}/openapi.json`} target="_blank" rel="noreferrer" className="btn-secondary !px-2.5 !py-1 text-xs">
                              Open ↗
                            </a>
                          ) : null}
                          <CopyButton value={ep.url} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Query playground */}
                <section className="card mt-6 p-6">
                  <h2 className="mb-3 text-sm font-semibold text-white">Query playground</h2>
                  <FilterPlayground apiSlug={api.slug} collectionSlug={collection.slug} schema={collection.schema} />
                </section>

                {/* Records preview */}
                <section className="card mt-6 p-6">
                  <h2 className="mb-3 text-sm font-semibold text-white">Records preview</h2>
                  <RecordsTable apiSlug={api.slug} collectionSlug={collection.slug} schema={collection.schema} />
                </section>
              </>
            ) : null}
          </>
        )}

        {/* MCP */}
        <section className="card mt-6 p-6">
          <h2 className="mb-1 text-sm font-semibold text-white">Connect an AI agent (MCP)</h2>
          <p className="mb-3 text-xs text-white/50">
            This API is also an MCP server. Point an agent at the endpoint below with a bearer
            token to let it read and write records.
          </p>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <span className="truncate font-mono text-xs text-white/60">{origin}/api/mcp/{api.slug}</span>
            <CopyButton value={`${origin}/api/mcp/${api.slug}`} />
          </div>
          <p className="mb-3 text-xs text-white/40">
            Send <code className="rounded bg-white/10 px-1 py-0.5 font-mono">Authorization: Bearer &lt;writeToken&gt;</code>.{" "}
            {api.hasWriteToken ? "A token already exists for this API — rotate below if you need a new one." : "No token yet — rotate one below."}
          </p>
          <McpConfigSnippet apiSlug={api.slug} origin={origin} />
        </section>

        {/* Actions */}
        <section className="card mt-6 p-6">
          <h2 className="mb-3 text-sm font-semibold text-white">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a href={`/api/_manage/apis/${api.slug}/export?format=yaml`} className="btn-secondary">
              ⬇ Export YAML
            </a>
            <a href={`/api/_manage/apis/${api.slug}/export?format=json`} className="btn-secondary">
              ⬇ Export JSON
            </a>
            <button type="button" onClick={() => setRotateOpen(true)} className="btn-secondary">
              ↻ Rotate write token
            </button>
          </div>
          {rotateError ? <p className="mt-3 text-sm text-red-300">{rotateError}</p> : null}
          {deleteError ? <p className="mt-3 text-sm text-red-300">{deleteError}</p> : null}
        </section>
      </main>

      <ConfirmDialog
        open={rotateOpen}
        title="Rotate write token?"
        body="The current write token will stop working immediately. Any MCP agents using it will need the new one."
        confirmLabel="Rotate token"
        loading={rotating}
        onConfirm={rotateToken}
        onCancel={() => setRotateOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${api.name}"?`}
        body="This permanently deletes the API, all its collections, and every record in them. This can't be undone."
        confirmLabel="Delete permanently"
        danger
        loading={deleting}
        onConfirm={deleteApi}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
