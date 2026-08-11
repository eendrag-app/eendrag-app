import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" emits a self-contained server in .next/standalone, which is
  // what the Dockerfile copies — that is the portability escape hatch, so it
  // has to keep working.
  //
  // Vercel does NOT ignore it, contrary to what this comment used to claim:
  // it runs its own file tracing and the build dies with
  //   ENOENT: .next/next-server.js.nft.json
  // So ask for standalone output only when we are not building on Vercel
  // (which sets VERCEL=1 in every build environment).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
