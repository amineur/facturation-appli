import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    // Optimize CSS delivery
    optimizeCss: false,
  },
  // Modularize imports for tree-shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
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
  webpack: (config, { dev, isServer }) => {
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

      // Optimize bundle splitting - CLIENT ONLY
      if (!isServer) {
        config.optimization = {
          ...config.optimization,
          moduleIds: 'deterministic',
          runtimeChunk: 'single',
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Vendor chunk
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
              },
              // Common chunk
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
                enforce: true,
              },
            },
          },
        };
      }
    }
    return config;
  },
  output: "standalone",
};

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default nextConfig;
