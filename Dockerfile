# ============================================================================
# ValueCanvas Production Dockerfile
# ============================================================================
# Multi-stage build for secure, optimized production deployment
# Compliant with Operation Fortress security standards
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20-alpine AS deps

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies
RUN npm prune --production --legacy-peer-deps

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
FROM node:20-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user (Operation Fortress security standard)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S valuecanvas -u 1001 -G nodejs

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=valuecanvas:nodejs /app/dist ./dist
COPY --from=builder --chown=valuecanvas:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=valuecanvas:nodejs /app/package*.json ./

# Copy necessary runtime files
COPY --chown=valuecanvas:nodejs start.sh ./
RUN chmod +x start.sh

# Switch to non-root user
USER valuecanvas

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5173/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["npm", "run", "preview"]

# ============================================================================
# Metadata
# ============================================================================
LABEL maintainer="ValueCanvas Team"
LABEL version="2.0"
LABEL description="ValueCanvas - AI-Powered Value Realization Platform"
LABEL security.standard="Operation Fortress"
LABEL org.opencontainers.image.source="https://github.com/bmsull560/ValueCanvas"
