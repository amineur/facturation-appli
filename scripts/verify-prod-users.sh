#!/bin/bash

# Script to verify all existing users in production database
# This connects to production DB and marks all users as emailVerified=true

echo "🔄 Connecting to production database..."
echo ""

# Run the migration script with production DATABASE_URL
npx tsx scripts/migrate-verify-existing-users.ts

echo ""
echo "✅ Migration complete!"
echo ""
echo "You can now login with any existing account."
