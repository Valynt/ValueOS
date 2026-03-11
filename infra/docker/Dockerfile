# ============================================================================
# ValueOS Production Dockerfile
# ============================================================================
# Multi-stage build for secure, optimized production deployment
# Supports both backend and frontend builds
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20.19.0-bookworm-slim AS deps

# Install security updates and build tools
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack
RUN corepack enable

WORKDIR /app

# Copy lockfile and workspace config for caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./

# Install dependencies into store
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

# Copy all source code
COPY . .

# Install dependencies
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

# ============================================================================
# Stage 2: Backend Builder
# ============================================================================
FROM deps AS backend-builder

WORKDIR /app

# Build the backend application
ARG APP=@valueos/backend
RUN turbo run build --filter=${APP}...

# Remove devDependencies for backend
RUN pnpm prune --prod --filter=${APP}...

# ============================================================================
# Stage 3: Frontend Builder
# ============================================================================
FROM deps AS frontend-builder

WORKDIR /app

# Build the frontend application
ARG APP=valynt-app
RUN turbo run build --filter=${APP}...

# ============================================================================
# Stage 4: Security Scanning
# ============================================================================
FROM deps AS security-scan

# Install trivy and syft for vulnerability scanning and SBOM generation
RUN TRIVY_VERSION=v0.50.4 && \
    SYFT_VERSION=v0.105.0 && \
    curl -sfL "https://raw.githubusercontent.com/aquasecurity/trivy/${TRIVY_VERSION}/contrib/install.sh" | sh -s -- -b /usr/local/bin && \
    curl -sfL "https://raw.githubusercontent.com/anchore/syft/${SYFT_VERSION}/install.sh" | sh -s -- -b /usr/local/bin

# Generate SBOMs for both backend and frontend
RUN syft dir /app/dist -o spdx-json > sbom-full.spdx.json 2>/dev/null || \
    (syft dir /app -o spdx-json > sbom-full.spdx.json)

# Security scan
RUN trivy filesystem --exit-code 1 --no-progress --ignore-unfixed /app

# ============================================================================
# Stage 5: Backend Production Runtime
# ============================================================================
FROM node:20.19.0-bookworm-slim AS backend-production

# Install runtime dependencies
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r nodejs -g 1001 && \
    useradd -r nodejs -u 1001 -g nodejs

WORKDIR /app

# Copy built backend application
COPY --from=backend-builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/package*.json ./

# Copy SBOM
COPY --from=security-scan --chown=nodejs:nodejs /app/sbom-full.spdx.json ./sbom-backend.spdx.json

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl --fail --silent --show-error \
  http://localhost:3001/health || exit 1

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/backend/server.js"]

# ============================================================================
# Stage 6: Frontend Production Runtime
# ============================================================================
FROM nginx:bookworm AS frontend-production

# Install curl for healthcheck
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create nginx directories
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy built frontend assets
COPY --from=frontend-builder --chown=nginx:nginx /app/apps/ValyntApp/dist /usr/share/nginx/html

# Copy nginx configuration
COPY infra/docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy SBOM
COPY --from=security-scan --chown=nginx:nginx /app/sbom-full.spdx.json /usr/share/nginx/html/sbom-frontend.spdx.json

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail --silent --show-error \
  http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

# ============================================================================
# Default target (can be overridden with --target)
# ============================================================================
FROM backend-production
