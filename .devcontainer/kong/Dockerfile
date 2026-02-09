FROM kong:alpine

# Install additional plugins if needed
USER root

# Add health check utilities
RUN apk add --no-cache curl wget

# Switch back to kong user
USER kong

# Expose ports
EXPOSE 8000 8443 8001 8444

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD kong health || exit 1
