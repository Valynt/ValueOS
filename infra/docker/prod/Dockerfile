FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build && npm prune --production

FROM node:18-alpine

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only necessary files
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

# Health check with liveness probe
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8000/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000

# Use exec form for proper signal handling
CMD ["node", "dist/backend/server.js"]
