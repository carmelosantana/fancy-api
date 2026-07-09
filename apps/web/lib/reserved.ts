/**
 * Slugs that would collide with platform routes if allowed as api/collection
 * slugs (`/api/_manage/*`, `/api/mcp/*`, `/api/[api]/openapi.json`).
 */
export const RESERVED_API_SLUGS = new Set(["_manage", "mcp"]);
export const RESERVED_COLLECTION_SLUGS = new Set(["openapi.json"]);

/**
 * Lowercase letters, digits, and hyphens; not leading/trailing with a
 * hyphen. Anything else doesn't round-trip cleanly through a URL path
 * segment.
 */
export const SLUG_FORMAT_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Validates an api slug: required, not a reserved word, and in the
 * allowed URL-safe format. Returns an error message, or `null` when the
 * slug is fine.
 *
 * Shared by both ways an api can come into existence — `POST /_manage/apis`
 * (create) and `POST /_manage/import` (import) — so the two paths enforce
 * identical rules and can't silently drift apart.
 */
export function validateApiSlug(slug: string): string | null {
  if (!slug) return "apiSlug is required";
  if (RESERVED_API_SLUGS.has(slug)) return `Reserved api slug: ${slug}`;
  if (!SLUG_FORMAT_RE.test(slug)) {
    return "Invalid apiSlug: must be lowercase letters, digits, and hyphens (no leading/trailing hyphen)";
  }
  return null;
}

/**
 * Same idea as `validateApiSlug`, for collection slugs. Shared by create
 * and import.
 */
export function validateCollectionSlug(slug: string): string | null {
  if (!slug) return "collectionSlug is required";
  if (RESERVED_COLLECTION_SLUGS.has(slug)) return `Reserved collection slug: ${slug}`;
  if (!SLUG_FORMAT_RE.test(slug)) {
    return "Invalid collectionSlug: must be lowercase letters, digits, and hyphens (no leading/trailing hyphen)";
  }
  return null;
}
