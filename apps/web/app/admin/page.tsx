import Link from "next/link";
import { listApis, listCollections, getApiStats } from "@app/core";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/NavBar";
import { ApiCard, type ApiCardData } from "@/components/admin/ApiCard";

// Reads live DB state per request — must not be statically prerendered at
// build time (that would freeze the API list as of the build).
export const dynamic = "force-dynamic";

async function loadApiCards(): Promise<ApiCardData[]> {
  const database = await db();
  const apis = await listApis(database);

  return Promise.all(
    apis.map(async (api) => {
      const collections = await listCollections(database, api.id);
      const stats = await getApiStats(database, api.id);
      return {
        slug: api.slug,
        name: api.name,
        description: api.description,
        collectionCount: collections.length,
        totalRecords: stats.totalRecords,
        totalRequests: stats.totalRequests,
      };
    }),
  );
}

export default async function AdminPage() {
  const apis = await loadApiCards();
  const totalRecords = apis.reduce((sum, a) => sum + a.totalRecords, 0);
  const totalRequests = apis.reduce((sum, a) => sum + a.totalRequests, 0);

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Your APIs</h1>
            <p className="mt-1 text-sm text-white/50">
              {apis.length === 0
                ? "Nothing here yet — spin up your first one."
                : `${apis.length} API${apis.length === 1 ? "" : "s"} · ${totalRecords.toLocaleString()} records · ${totalRequests.toLocaleString()} requests served`}
            </p>
          </div>
          <Link href="/admin/new" className="btn-primary px-5 py-2.5">
            ＋ New API
          </Link>
        </div>

        {apis.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center">
            <span className="text-4xl">📦</span>
            <h2 className="text-lg font-semibold text-white">No APIs yet</h2>
            <p className="max-w-sm text-sm text-white/50">
              Paste a table, upload a CSV, or import a spec — you&apos;ll have a live, queryable
              API in under a minute.
            </p>
            <Link href="/admin/new" className="btn-primary mt-2 px-5 py-2.5">
              Create your first API →
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {apis.map((api) => (
              <ApiCard key={api.slug} api={api} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
