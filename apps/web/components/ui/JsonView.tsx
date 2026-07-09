import { CopyButton } from "./CopyButton";

export function JsonView({ data, className = "" }: { data: unknown; className?: string }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/40 ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-white/40">json</span>
        <CopyButton value={text} />
      </div>
      <pre className="max-h-96 overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-cyan-100/90">
        <code>{text}</code>
      </pre>
    </div>
  );
}
