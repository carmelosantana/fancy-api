/**
 * Slugs that would collide with platform routes if allowed as api/collection
 * slugs (`/api/_manage/*`, `/api/mcp/*`, `/api/[api]/openapi.json`).
 */
export const RESERVED_API_SLUGS = new Set(["_manage", "mcp"]);
export const RESERVED_COLLECTION_SLUGS = new Set(["openapi.json"]);
