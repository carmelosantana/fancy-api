import type { Db } from "../db/client";
import { getApiBySlug, listCollections } from "../repo/apis";
import { listRecords } from "../repo/records";
import type { ApiSpec, CollectionSpec } from "./types";

const EXPORT_PAGE_SIZE = 10_000;

/**
 * `config` is a free-form JSON bag on the api row. The only key any part of
 * this codebase actually reads out of it today is `readKey` (the public-read
 * gate, see `apps/web/lib/publicApi.ts`'s `readKeyOf`) — which is exactly the
 * kind of secret a portable, shareable spec must never carry. Rather than
 * trying to enumerate every secret-shaped key name (and inevitably missing
 * the next one someone adds), this is an allowlist: only keys explicitly
 * named here are copied into the exported spec, everything else in `config`
 * is dropped by default. There are no non-secret config keys in use yet, so
 * this list starts empty; add to it deliberately if a real non-secret config
 * key shows up.
 */
const EXPORTABLE_CONFIG_KEYS: readonly string[] = [];

function exportableConfig(config: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!config) return out;
  for (const key of EXPORTABLE_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      out[key] = config[key];
    }
  }
  return out;
}

/**
 * Assembles a portable, secret-free declarative spec for an api: its
 * collections and their record data (internal ids and secrets omitted).
 * Secrets never appear at the top level of `ApiSpec` (there's no field for
 * them there), and `config` is passed through an explicit allowlist rather
 * than copied wholesale, so a read key or any other secret living in
 * `config` can never leak into an exported spec.
 */
export async function exportApi(db: Db, apiSlug: string): Promise<ApiSpec> {
  const api = await getApiBySlug(db, apiSlug);
  if (!api) throw new Error(`Api not found: ${apiSlug}`);

  const collectionRows = await listCollections(db, api.id);

  const collections: CollectionSpec[] = [];
  for (const collection of collectionRows) {
    const { data } = await listRecords(db, collection.id, { limit: EXPORT_PAGE_SIZE });
    const records = data.map(({ id: _id, ...rest }) => rest);
    collections.push({
      slug: collection.slug,
      name: collection.name,
      schema: collection.schema,
      records,
    });
  }

  return {
    slug: api.slug,
    name: api.name,
    description: api.description ?? undefined,
    config: exportableConfig(api.config),
    collections,
  };
}
