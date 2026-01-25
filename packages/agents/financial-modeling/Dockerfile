# ============================================================================
# ValueOS Agent Dockerfile Template
# ============================================================================
# Template for containerizing individual agents
# Copy this to each agent directory and customize as needed
# ============================================================================

# Build stage
FROM node:20.19.0-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/agents/package*.json ./packages/agents/
COPY packages/agents/base/package*.json ./packages/agents/base/

# Install dependencies
RUN npm ci --legacy-peer-deps --workspace=packages/agents/base

# Copy source code
COPY packages/agents/base ./packages/agents/base
COPY src ./src
COPY tsconfig.json ./

# Build the agent
RUN npm run build --workspace=packages/agents/base && \
    npm run build

# Production stage
FROM node:20.19.0-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agent -u 1001 -G nodejs

WORKDIR /app

# Copy built application
COPY --from=builder --chown=agent:nodejs /app/dist ./dist
COPY --from=builder --chown=agent:nodejs /app/packages/agents/base/dist ./packages/agents/base/dist
COPY --from=builder --chown=agent:nodejs /app/package*.json ./
COPY --from=builder --chown=agent:nodejs /app/packages/agents/package*.json ./packages/agents/
COPY --from=builder --chown=agent:nodejs /app/packages/agents/base/package*.json ./packages/agents/base/

# Install production dependencies only
RUN npm ci --only=production --legacy-peer-deps --workspace=packages/agents/base && \
    npm cache clean --force

# Switch to non-root user
USER agent

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
