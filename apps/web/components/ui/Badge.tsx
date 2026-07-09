import type { Milestone } from "@/lib/milestones";

export function Badge({ emoji, label }: Milestone) {
  return (
    <span className="badge-pill" title={label}>
      <span aria-hidden="true">{emoji}</span>
      {label}
    </span>
  );
}

export function BadgeRow({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-xs text-white/40">No badges yet — ship some data to earn your first one.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {milestones.map((m) => (
        <Badge key={m.id} {...m} />
      ))}
    </div>
  );
}
