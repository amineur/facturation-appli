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
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      'date-fns'
    ],
  },
  // Compiler options for production optimization
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  compress: true,
  images: {
    localPatterns: [
      {
        pathname: '/api/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@next/devtools': false,
      };

      // Force tree-shaking for Recharts
      config.module.rules.push({
        test: /node_modules\/recharts/,
        sideEffects: false,
      });
    }
    return config;
  },
  output: "standalone",
};

export default nextConfig;
