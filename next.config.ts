import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  // Force project root tracing to prevent scanning parent directories on D drive
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
