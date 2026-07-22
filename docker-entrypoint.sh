#!/bin/sh
set -e

# Host-mounted ./data often arrives as root-owned. Fix ownership before dropping privileges.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

export DATABASE_URL="${DATABASE_URL:-file:/app/data/plop.db}"

# Apply schema, then start the app as the non-root user
exec su -s /bin/sh nextjs -c '
  export DATABASE_URL
  node node_modules/prisma/build/index.js db push --skip-generate
  exec node server.js
'
