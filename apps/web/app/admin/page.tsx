import { listApis } from "@app/core";
import { db } from "@/lib/db";

// Reads live DB state per request — must not be statically prerendered at
// build time (that would freeze the API list as of the build).
export const dynamic = "force-dynamic";

// Placeholder admin dashboard — just proves the auth wiring + core read
// path work end to end. The real builder UI (create/edit/import/export,
// live playground, etc.) is a later task.
export default async function AdminPage() {
  const database = await db();
  const apis = await listApis(database);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-xl font-semibold">APIs</h1>
      {apis.length === 0 ? (
        <p className="text-sm text-gray-500">No APIs yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {apis.map((api) => (
            <li key={api.slug} className="rounded border px-3 py-2">
              <span className="font-mono">{api.slug}</span>
              <span className="ml-2 text-gray-500">{api.name}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-gray-400">
        The builder UI (create/edit/import/export) lands in a later task.
      </p>
    </main>
  );
}
