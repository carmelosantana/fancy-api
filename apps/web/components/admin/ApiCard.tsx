import Link from "next/link";
import { StatCounter } from "@/components/ui/StatCounter";
import { BadgeRow } from "@/components/ui/Badge";
import { milestonesFor } from "@/lib/milestones";

export interface ApiCardData {
  slug: string;
  name: string;
  description: string | null;
  collectionCount: number;
  totalRecords: number;
  totalRequests: number;
}

export function ApiCard({ api }: { api: ApiCardData }) {
  const milestones = milestonesFor({
    totalRecords: api.totalRecords,
    totalRequests: api.totalRequests,
    collections: api.collectionCount,
  });

  return (
    <Link
      href={`/admin/apis/${api.slug}`}
      className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-white">{api.name}</h3>
          <span className="text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/50">
            →
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-white/40">/api/{api.slug}</p>
        {api.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-white/50">{api.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
        <div>
          <div className="text-lg font-bold text-white">{api.collectionCount}</div>
          <div className="text-[10px] uppercase tracking-wide text-white/35">collections</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white">
            <StatCounter value={api.totalRecords} />
          </div>
          <div className="text-[10px] uppercase tracking-wide text-white/35">records</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white">
            <StatCounter value={api.totalRequests} />
          </div>
          <div className="text-[10px] uppercase tracking-wide text-white/35">requests</div>
        </div>
      </div>

      <BadgeRow milestones={milestones} />
    </Link>
  );
}
