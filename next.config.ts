import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: true, // Enable for deep debugging
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  output: "standalone",
};

export default nextConfig;
