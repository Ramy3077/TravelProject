import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Directory of this config file = the web/ app root.
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Self-contained server bundle for container/Cloud Run deploys.
  output: "standalone",
  // Pin the workspace root to web/. Without this, Turbopack walks up the tree,
  // finds a stray lockfile in a parent directory, and infers the wrong root
  // (emitting a build warning). The app is self-contained in web/.
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
