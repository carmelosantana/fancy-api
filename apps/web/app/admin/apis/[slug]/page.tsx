import { notFound } from "next/navigation";
import { getApiBySlug, listCollections, getApiStats } from "@app/core";
import { db } from "@/lib/db";
import { ApiDetailClient } from "@/components/admin/ApiDetailClient";

// Reads live DB state per request — must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ApiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const database = await db();

  const api = await getApiBySlug(database, slug);
  if (!api) notFound();

  const collections = await listCollections(database, api.id);
  const stats = await getApiStats(database, api.id);
  const config = api.config as { readKey?: unknown };

  return (
    <ApiDetailClient
      api={{
        slug: api.slug,
        name: api.name,
        description: api.description,
        hasWriteToken: Boolean(api.writeTokenHash),
        hasReadKey: Boolean(api.readKey || config?.readKey),
      }}
      collections={collections.map((c) => ({ slug: c.slug, name: c.name, schema: c.schema }))}
      stats={stats}
    />
  );
}
