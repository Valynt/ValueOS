# ValueOS Port Configuration Template
# Copy this file to .env.ports and customize as needed
# This file is gitignored - do not commit actual values

# Database Ports
POSTGRES_PORT=5432
REDIS_PORT=6379

# Application Ports
API_PORT=3001
VITE_PORT=5173

# Supabase Ports (if running locally)
SUPABASE_API_PORT=54321
SUPABASE_STUDIO_PORT=54323

# Supabase URLs
SUPABASE_INTERNAL_URL=http://kong:8000
SUPABASE_PUBLIC_URL=http://localhost:${SUPABASE_API_PORT}

# Reverse Proxy Ports
CADDY_HTTP_PORT=8080
CADDY_HTTPS_PORT=8443
CADDY_ADMIN_PORT=2019

# Observability Ports
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000

# Security Configuration
GRAFANA_ADMIN_PASSWORD=change_me_in_production

# Development Domain
DEV_DOMAIN=localhost

# Service URLs (auto-configured)
API_UPSTREAM=http://backend:3001
FRONTEND_UPSTREAM=http://frontend:5173

# Logging Configuration
CADDY_LOG_LEVEL=DEBUG
AUTO_HTTPS=off
