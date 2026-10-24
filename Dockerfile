# ==============================================================================
# Yassir Express Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY schemas/ ./schemas/
COPY proto/ ./proto/

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
