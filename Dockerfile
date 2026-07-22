# Build stage
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Ensure public exists even if the repo has no static assets
RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data /app/node_modules/.prisma /app/node_modules/@prisma /app/node_modules/prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Apply schema on boot (safe for SQLite volume mounts), then start the app
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
