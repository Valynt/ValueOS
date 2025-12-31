# ============================================================================
# ValueCanvas Backend API Dockerfile
# ============================================================================
# Optimized multi-stage build for Express backend
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for TypeScript compilation)
RUN npm ci --legacy-peer-deps && \
    npm cache clean --force

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Install production dependencies only
RUN npm ci --legacy-peer-deps --only=production && \
    npm cache clean --force

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
FROM node:20-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S valuecanvas -u 1001 -G nodejs

WORKDIR /app

# Copy built application
COPY --from=builder --chown=valuecanvas:nodejs /app/dist ./dist
COPY --from=builder --chown=valuecanvas:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=valuecanvas:nodejs /app/package*.json ./

# Switch to non-root user
USER valuecanvas

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/backend/server.js"]

# ============================================================================
# Metadata
# ============================================================================
LABEL maintainer="ValueCanvas Team"
LABEL component="backend"
LABEL version="1.0"
