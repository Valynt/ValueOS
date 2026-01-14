# Port Mapping Guide

**Version**: 1.0  
**Last Updated**: January 2026

This document describes the port mapping conventions across ValueOS environments and explains intentional variances between development and production configurations.

---

## Port Registry

The canonical port registry is located at `config/ports.json`. All services should reference this file for port assignments.

### Core Services

| Service         | Port  | Description                      |
| --------------- | ----- | -------------------------------- |
| Frontend (Vite) | 5173  | React development server         |
| Frontend HMR    | 24678 | Hot Module Replacement WebSocket |
| Backend API     | 3001  | Node.js BFF server (production)  |
| PostgreSQL      | 5432  | Supabase database                |
| Redis           | 6379  | Cache layer                      |

### Supabase Services

| Service         | Port  | Description            |
| --------------- | ----- | ---------------------- |
| Supabase API    | 54321 | REST/GraphQL API       |
| Supabase Studio | 54323 | Database management UI |

### Edge/Gateway

| Service | Port | Description              |
| ------- | ---- | ------------------------ |
| HTTP    | 8080 | Caddy/Edge HTTP traffic  |
| HTTPS   | 8443 | Caddy/Edge HTTPS traffic |
| Admin   | 2019 | Caddy admin API          |

### Observability Stack

| Service    | Port  | Description              |
| ---------- | ----- | ------------------------ |
| Prometheus | 9090  | Metrics collection       |
| Grafana    | 3000  | Visualization dashboards |
| Jaeger     | 16686 | Distributed tracing UI   |
| Loki       | 3100  | Log aggregation          |
| Tempo      | 3200  | Trace storage            |
| OTLP gRPC  | 4317  | OpenTelemetry gRPC       |
| OTLP HTTP  | 4318  | OpenTelemetry HTTP       |

---

## Environment-Specific Variances

### Development Environment (`infra/compose/compose.dev.yml`)

| Service     | Dev Port | Production Port | Reason                                               |
| ----------- | -------- | --------------- | ---------------------------------------------------- |
| Backend API | **8000** | 3001            | Avoids conflict with local Grafana (3000) during dev |
| Caddy HTTP  | 8080     | 80              | Non-privileged port for local development            |
| Caddy HTTPS | 8443     | 443             | Non-privileged port for local development            |

### Why Backend Uses Port 8000 in Dev

The development compose file (`compose.dev.yml`) uses port `8000` for the backend instead of `3001` to:

1. **Avoid Grafana conflict**: Grafana runs on port `3000` in the observability stack. Using `8000` for backend prevents confusion.
2. **Match common conventions**: Port `8000` is a common development server port.
3. **Caddy proxying**: In dev, Caddy proxies `/api` to `http://backend:8000`, abstracting the port from frontend code.

### Production Configuration

In production (`docker-compose.yml` and `docker-compose.prod.yml`):

- Backend runs on port `3001` as specified in `config/ports.json`
- Caddy handles SSL termination on standard ports (80/443)
- All services use the canonical ports from the registry

---

## Configuration Files

### `config/ports.json`

```json
{
  "frontend": { "port": 5173, "hmrPort": 24678 },
  "backend": { "port": 3001 },
  "postgres": { "port": 5432 },
  "redis": { "port": 6379 },
  "supabase": { "apiPort": 54321, "studioPort": 54323 },
  "edge": { "httpPort": 8080, "httpsPort": 8443, "adminPort": 2019 },
  "observability": {
    "prometheusPort": 9090,
    "grafanaPort": 3000,
    "jaegerPort": 16686,
    "lokiPort": 3100,
    "tempoPort": 3200
  }
}
```

### `.env.ports`

Environment-specific overrides. Example:

```bash
POSTGRES_PORT=5432
REDIS_PORT=6379
API_PORT=3001
VITE_PORT=5173
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

---

## Adding a New Service

When adding a new service:

1. **Register the port** in `config/ports.json`
2. **Update `.env.ports`** with the new port variable
3. **Update docker-compose files** to use the environment variable:
   ```yaml
   ports:
     - "${NEW_SERVICE_PORT:-8888}:8888"
   ```
4. **Document** any dev/prod variance in this guide

### Validation

Per `.windsurfrules.md`:

> "Port mappings must be updated in `config/ports.json` whenever a new service is added."

Use the Codemap `@{infra-map}` to verify port consistency:

```
@{infra-map}: Link devcontainer.json → .devcontainer/scripts/* → docker-compose files
Validate: Environment variables consistency across compose files
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using a port
lsof -i :3001

# Kill process on port
kill -9 $(lsof -t -i :3001)
```

### Docker Port Conflicts

```bash
# List all container port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Check specific service
docker-compose ps
```

### Verify Port Registry Consistency

Run the deployment validation script:

```bash
bash scripts/validate-deployment.sh local
```

This will check that all services are accessible on their expected ports.

---

## Related Documentation

- `.windsurfrules.md` - Workspace rules including port mapping requirements
- `infra/compose/compose.dev.yml` - Development compose configuration
- `docker-compose.yml` - Default/staging compose configuration
- `docker-compose.prod.yml` - Production compose configuration
