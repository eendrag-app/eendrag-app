import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" makes `next build` emit a self-contained server in
  // .next/standalone — this is what the Dockerfile copies. Vercel ignores it.
  output: "standalone",
};

export default nextConfig;
