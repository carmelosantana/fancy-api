import { CodeBlock } from "@/components/ui/CodeBlock";

/**
 * Ready-to-paste MCP client config pointing an agent at `/api/mcp/[slug]`.
 * When `writeToken` is omitted, a placeholder is shown instead (used on the
 * detail page, where the real token isn't available after the first reveal).
 */
export function McpConfigSnippet({
  apiSlug,
  origin,
  writeToken,
}: {
  apiSlug: string;
  origin: string;
  writeToken?: string;
}) {
  const token = writeToken ?? "YOUR_WRITE_TOKEN";
  const config = {
    mcpServers: {
      [apiSlug]: {
        url: `${origin}/api/mcp/${apiSlug}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  };

  return <CodeBlock label={`mcp config · ${apiSlug}`} code={JSON.stringify(config, null, 2)} />;
}
