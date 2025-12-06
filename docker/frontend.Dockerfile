# ============================================================================
# ValueCanvas Frontend Dockerfile
# ============================================================================
# Optimized multi-stage build for React/Vite frontend
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps --only=production && \
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

# Build arguments for environment
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_LLM_API_KEY
ARG VITE_LLM_PROVIDER=together
ARG VITE_APP_URL

# Set environment variables for build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_LLM_API_KEY=$VITE_LLM_API_KEY
ENV VITE_LLM_PROVIDER=$VITE_LLM_PROVIDER
ENV VITE_APP_URL=$VITE_APP_URL

# Build application
RUN npm run build

# ============================================================================
# Stage 3: Production Runtime with Nginx
# ============================================================================
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Run as non-root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# ============================================================================
# Metadata
# ============================================================================
LABEL maintainer="ValueCanvas Team"
LABEL component="frontend"
LABEL version="1.0"
