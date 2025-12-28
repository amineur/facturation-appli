import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default nextConfig;
