FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build
RUN bun install --frozen-lockfile --production

# ── Production stage ──
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock* ./

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
EXPOSE 3100

CMD ["node", "dist/index.js"]
