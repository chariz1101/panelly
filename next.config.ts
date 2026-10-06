import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static site only: no server, no API routes. `next build` writes to `out/`.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
