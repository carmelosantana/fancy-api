import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Deliberately not importing `@app/core` here (its findRepoRoot walks up
// looking for pnpm-workspace.yaml): next.config.ts is loaded standalone by
// Next's own config loader before the rest of the app's dependency graph is
// available, so pulling in a workspace package (with its own drizzle-orm /
// zod / mcp-sdk deps) at config-load time is fragile. apps/web's position
// two levels below the repo root is a fixed structural fact, so we just
// resolve it directly.
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  // Produces `.next/standalone` — a self-contained server bundle (only the
  // node_modules actually reachable from the traced output graph) that the
  // Dockerfile copies into the runner stage instead of shipping the whole
  // workspace + node_modules.
  output: "standalone",
  // This is a pnpm workspace: apps/web's own node_modules doesn't contain
  // everything it resolves (workspace packages + hoisted deps live at the
  // repo root). Without this, Next's file tracing anchors at apps/web and
  // silently drops repo-root-level dependencies from the standalone bundle.
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@app/core"],
  // @libsql/client ships native bindings + a require.context-style dynamic
  // require that webpack can't statically bundle (it chokes on the
  // package's README/LICENSE files). Keep it (and its native dep) as a
  // real Node.js `require` at runtime instead of bundling it.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
