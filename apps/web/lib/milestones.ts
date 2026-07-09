export interface Milestone {
  id: string;
  emoji: string;
  label: string;
}

/**
 * Gamification badges earned per-api, purely derived from counters that
 * already exist (records / requests / collections) — no extra state to
 * store or keep in sync.
 */
export function milestonesFor(stats: {
  totalRecords: number;
  totalRequests: number;
  collections: number;
}): Milestone[] {
  const badges: Milestone[] = [];

  if (stats.collections > 0) {
    badges.push({ id: "first-api", emoji: "🎉", label: "First API" });
  }
  if (stats.collections >= 3) {
    badges.push({ id: "multi-collection", emoji: "🗂️", label: "3+ collections" });
  }
  if (stats.totalRecords >= 100) {
    badges.push({ id: "records-100", emoji: "📚", label: "100 records" });
  }
  if (stats.totalRecords >= 1000) {
    badges.push({ id: "records-1000", emoji: "🏛️", label: "1k records" });
  }
  if (stats.totalRequests >= 1) {
    badges.push({ id: "first-request", emoji: "🚀", label: "First request served" });
  }
  if (stats.totalRequests >= 100) {
    badges.push({ id: "requests-100", emoji: "⚡", label: "100 requests served" });
  }
  if (stats.totalRequests >= 1000) {
    badges.push({ id: "requests-1000", emoji: "🔥", label: "1k requests served" });
  }
  if (stats.totalRequests >= 10000) {
    badges.push({ id: "requests-10000", emoji: "🌋", label: "10k requests served" });
  }

  return badges;
}
