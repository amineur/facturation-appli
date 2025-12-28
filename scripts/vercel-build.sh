#!/bin/bash

# Only run migrations if we are in the Vercel environment
if [ "$VERCEL" = "1" ]; then
  echo "🚀 [Safe Mode] Detected Vercel Environment. Running Database Migrations..."
  npx prisma migrate deploy
else
  echo "ℹ️ [Safe Mode] Local build detected. Skipping auto-migration to protect production DB."
fi

# Always run the Next.js build using Webpack (required for custom config)
echo "📦 Building Next.js App (Webpack Mode)..."
next build --webpack
