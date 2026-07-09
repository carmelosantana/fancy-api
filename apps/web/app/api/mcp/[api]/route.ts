import { createMcpHandler } from "mcp-handler";
import type { z } from "zod";
import { getToolDefinitions } from "@app/core";
import { db } from "@/lib/db";

/**
 * MCP over Streamable HTTP, scoped to one api (`params.api`), via the
 * `mcp-handler` package (thin Next.js adapter over
 * `@modelcontextprotocol/sdk`'s Streamable HTTP transport).
 *
 * `mcp-handler` is built around a single fixed `[transport]` route (e.g.
 * `app/[transport]/route.ts`) whose `basePath` config derives a *static*
 * endpoint path ("/mcp" by default) that the transport matches the request
 * URL against internally. Our route is dynamic and per-api
 * (`/api/mcp/<slug>`), so instead of fighting that basePath derivation we
 * build the handler *inside* the request function and pass the exact
 * incoming pathname as `streamableHttpEndpoint` — the transport's own
 * `url.pathname === streamableHttpEndpoint` check then always matches.
 * `initializeServer` runs fresh per POST regardless (see the library's
 * `initializeMcpApiHandler`), so this is not more wasteful than the
 * "normal" single-route usage; it just lets each request carry its own
 * `apiSlug`/token via closure instead of a module-level constant.
 */

function extractToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, value] = auth.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value) return value;
  }
  return req.headers.get("x-write-token") ?? undefined;
}

async function handleMcpRequest(
  req: Request,
  { params }: { params: Promise<{ api: string }> },
): Promise<Response> {
  const { api: apiSlug } = await params;
  const token = extractToken(req);
  const url = new URL(req.url);

  const handler = createMcpHandler(
    (server) => {
      for (const def of getToolDefinitions()) {
        const shape = (def.inputSchema as z.ZodObject<z.ZodRawShape>).shape;
        server.tool(def.name, def.description, shape, async (args: Record<string, unknown>) => {
          try {
            const database = await db();
            const result = await def.handler(database, { apiSlug, ...args }, { token });
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
          } catch (err) {
            return {
              content: [{ type: "text" as const, text: (err as Error).message }],
              isError: true,
            };
          }
        });
      }
    },
    { serverInfo: { name: `dap-${apiSlug}`, version: "0.1.0" } },
    {
      streamableHttpEndpoint: url.pathname,
      disableSse: true,
    },
  );

  return handler(req);
}

export async function POST(req: Request, ctx: { params: Promise<{ api: string }> }) {
  return handleMcpRequest(req, ctx);
}

export async function GET(req: Request, ctx: { params: Promise<{ api: string }> }) {
  return handleMcpRequest(req, ctx);
}
