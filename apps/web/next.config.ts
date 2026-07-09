import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@app/core"],
  // @libsql/client ships native bindings + a require.context-style dynamic
  // require that webpack can't statically bundle (it chokes on the
  // package's README/LICENSE files). Keep it (and its native dep) as a
  // real Node.js `require` at runtime instead of bundling it.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
