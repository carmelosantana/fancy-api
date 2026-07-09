import { CodeBlock } from "@/components/ui/CodeBlock";
import { McpConfigSnippet } from "@/components/McpConfigSnippet";

export function TokenRevealCard({
  apiSlug,
  origin,
  token,
  note,
}: {
  apiSlug: string;
  origin: string;
  token: string;
  note?: string;
}) {
  return (
    <div className="card border-amber-400/30 bg-amber-400/[0.04] p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🔑</span>
        <h3 className="text-sm font-semibold text-white">Write token {note ? `(${note})` : "(shown once)"}</h3>
      </div>
      <p className="mb-3 text-xs text-amber-200/80">
        This is the only time this token is shown. Store it somewhere safe — you&apos;ll need it
        for an MCP agent to write to this API.
      </p>
      <CodeBlock label="write token" code={token} />
      <div className="mt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
          MCP client config
        </h4>
        <McpConfigSnippet apiSlug={apiSlug} origin={origin} writeToken={token} />
      </div>
    </div>
  );
}
