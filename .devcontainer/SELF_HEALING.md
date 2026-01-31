# Self-Healing DevContainer

## Overview

The ValueOS DevContainer includes an automated self-healing system that monitors and repairs infrastructure services.

## Features

- ✅ **Port availability checking** - Ensures all services are responding
- ✅ **Service health monitoring** - Checks Docker container health status
- ✅ **Automatic restart** - Restarts unhealthy or crashed services
- ✅ **Migration folder validation** - Ensures schema consistency
- ✅ **Stale container cleanup** - Removes exited containers

## Monitored Services

| Service     | Port  | Purpose                 |
| ----------- | ----- | ----------------------- |
| Frontend    | 5173  | Vite development server |
| Backend API | 3001  | Express backend         |
| Supabase    | 54321 | Database API gateway    |
| PostgreSQL  | 5432  | Database                |
| Redis       | 6379  | Cache layer             |
| Grafana     | 3000  | Metrics visualization   |
| Prometheus  | 9090  | Metrics collection      |
| Tempo       | 3200  | Distributed tracing     |

## Usage

### Automatic Mode

Self-healing ran automatically in the legacy setup via `post-start.sh`. The current unified devcontainer uses a simplified lifecycle.

### Manual Mode (Legacy)

The self-healing scripts are archived in `docs/legacy/scripts/devcontainer-scripts/`:

```bash
# One-time check (legacy)
bash docs/legacy/scripts/devcontainer-scripts/self-heal.sh

# Watch mode (checks every 60 seconds) (legacy)
bash docs/legacy/scripts/devcontainer-scripts/self-heal.sh --watch
```

## How It Works

1. **Port Check** - Verifies each service port responds
2. **Container Check** - Confirms Docker container is running
3. **Health Check** - Inspects container health status
4. **Remediation**:
   - If unhealthy → Restart service
   - If stopped → Start service
   - If stale → Remove and restart

## Configuration

Services and ports are defined in the script:

```bash
PORTS=(
    "5173:frontend:Frontend (Vite)"
    "3001:backend:Backend API"
    "54321:supabase:Supabase API"
    # ...
)
```

## Logs

Self-healing output uses color-coded messages:

- 🟢 **Green** - Success/healthy service
- 🟡 **Yellow** - Warning/restarting service
- 🔴 **Red** - Error/failed action

## Integration

The script integrated with the legacy setup:

- **docker-compose.devcontainer.yml** - Current service definitions
- **docs/legacy/devcontainer/docker-compose.\*.yml** - Legacy service definitions
- **docs/legacy/scripts/devcontainer-scripts/post-start.sh** - Legacy automatic trigger

## Troubleshooting

### Service Won't Start

```bash
# Check Docker logs (current)
docker compose -f .devcontainer/docker-compose.devcontainer.yml logs [service-name]

# Manual restart (current)
docker compose -f .devcontainer/docker-compose.devcontainer.yml restart [service-name]

# Legacy commands (archived in docs/legacy/)
# docker compose -f infra/docker/docker-compose.dev.yml logs [service-name]
```

### Port Conflicts

```bash
# Check what's using a port
lsof -i :[port-number]

# Kill process using port
kill -9 [PID]
```

### Disable Self-Healing

Comment out the self-heal call in `.devcontainer/scripts/post-start.sh`:

```bash
# Run self-healing if Docker is available
# if check_docker_socket; then
#     run_self_heal || true
# fi
```

## Development

To modify the self-healing behavior:

1. Edit `.devcontainer/scripts/self-heal.sh`
2. Update `PORTS` array to add/remove services
3. Adjust health check logic in `check_service_health()`
4. Test changes: `bash .devcontainer/scripts/self-heal.sh`

## Requirements

- Docker and Docker Compose installed
- `nc` (netcat) for port checking
- ValueOS project structure with `infra/docker/docker-compose.dev.yml`

## Related Files

- `.devcontainer/scripts/self-heal.sh` - Main healing script
- `.devcontainer/scripts/post-start.sh` - Automatic trigger
- `infra/docker/docker-compose.dev.yml` - Service definitions
- `deploy/envs/.env.ports` - Port configuration
