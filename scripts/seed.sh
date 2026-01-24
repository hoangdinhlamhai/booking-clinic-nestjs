#!/bin/sh
# Run this script manually to seed the database
# Usage: docker exec <container_id> sh /app/scripts/seed.sh

echo "🌱 Starting database seed..."

# Run prisma db seed
npx prisma db seed

echo "✅ Seed completed!"
