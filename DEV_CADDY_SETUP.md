# ValueCanvas Development Setup with Caddy

Complete development environment with Caddy reverse proxy for optimal developer experience.

## Quick Start

```bash
# Start development environment
./scripts/dev-caddy-start.sh

# Stop development environment
./scripts/dev-caddy-stop.sh
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Main Application** | http://localhost | Proxied through Caddy |
| **Vite Dev Server** | http://localhost:3000 | Direct access (also proxied) |
| **Static Files** | http://localhost:8080 | Pre-built files |
| **Caddy Admin API** | http://localhost:2019 | Runtime configuration |
| **PostgreSQL** | localhost:5432 | Database |
| **Redis** | localhost:6379 | Cache |

## Features

### 🚀 Development Optimized
- **Hot Module Replacement (HMR)** - Instant updates
- **Debug Mode** - Verbose logging
- **Relaxed Security** - Easy CORS and CSP
- **Large Request Limits** - 100MB for testing uploads
- **Extended Timeouts** - For debugging sessions

### 🔧 Caddy Features
- **Auto HTTPS** - Disabled for localhost
- **Admin API** - Runtime configuration at :2019
- **Health Checks** - Monitor service status
- **Request Tracing** - UUID for each request
- **WebSocket Support** - Automatic upgrade for HMR
- **Compression** - Gzip for faster loads

### 📦 Services Included
- **Caddy** - Reverse proxy and static file server
- **Vite** - Frontend dev server with HMR
- **PostgreSQL** - Database
- **Redis** - Caching layer

## Configuration Files

### Caddyfile.dev
Development-optimized Caddy configuration:
- Relaxed security headers
- Debug logging
- Wide-open CORS
- Extended timeouts
- Request body limit: 100MB

### docker-compose.dev-caddy.yml
Complete development stack:
- All services with health checks
- Volume mounts for hot reload
- Exposed ports for direct access
- Resource limits optimized for dev

### .env.dev
Environment variables for development:
- Database credentials
- Redis password
- API keys
- Feature flags
- Debug settings

## Manual Commands

### Start Services
```bash
docker-compose -f docker-compose.dev-caddy.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.dev-caddy.yml down
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.dev-caddy.yml logs -f

# Specific service
docker-compose -f docker-compose.dev-caddy.yml logs -f caddy
docker-compose -f docker-compose.dev-caddy.yml logs -f app
docker-compose -f docker-compose.dev-caddy.yml logs -f postgres
```

### Restart Service
```bash
docker-compose -f docker-compose.dev-caddy.yml restart caddy
docker-compose -f docker-compose.dev-caddy.yml restart app
```

### Rebuild
```bash
docker-compose -f docker-compose.dev-caddy.yml up -d --build
```

## Caddy Admin API

### View Current Configuration
```bash
curl http://localhost:2019/config/ | jq
```

### Reload Configuration
```bash
caddy reload --config Caddyfile.dev --adapter caddyfile
```

### Check Caddy Health
```bash
curl http://localhost/caddy-health
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 80
lsof -i :80

# Stop the process or use different port
```

### Caddy Not Starting
```bash
# Validate Caddyfile syntax
caddy validate --config Caddyfile.dev --adapter caddyfile

# Check logs
docker-compose -f docker-compose.dev-caddy.yml logs caddy
```

### HMR Not Working
1. Check WebSocket connection in browser DevTools
2. Verify Vite dev server is running: `curl http://localhost:3000`
3. Check HMR port is accessible: `curl http://localhost:24678`
4. Restart app service: `docker-compose -f docker-compose.dev-caddy.yml restart app`

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker exec valuecanvas-postgres-dev pg_isready -U valuecanvas

# Connect to database
docker exec -it valuecanvas-postgres-dev psql -U valuecanvas -d valuecanvas_dev

# View logs
docker-compose -f docker-compose.dev-caddy.yml logs postgres
```

### Redis Connection Issues
```bash
# Check Redis is running
docker exec valuecanvas-redis-dev redis-cli -a dev_redis_password ping

# Connect to Redis CLI
docker exec -it valuecanvas-redis-dev redis-cli -a dev_redis_password

# View logs
docker-compose -f docker-compose.dev-caddy.yml logs redis
```

## Environment Setup

### First Time Setup

1. **Copy environment file**
   ```bash
   cp .env.dev.example .env.dev
   ```

2. **Update credentials**
   Edit `.env.dev` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_LLM_API_KEY`

3. **Start services**
   ```bash
   ./scripts/dev-caddy-start.sh
   ```

4. **Verify setup**
   - Open http://localhost
   - Check all services are healthy
   - Test HMR by editing a file in `./src`

## Development Workflow

1. **Start environment** - `./scripts/dev-caddy-start.sh`
2. **Edit code** - Files in `./src` with hot reload
3. **Test changes** - http://localhost
4. **View logs** - `docker-compose -f docker-compose.dev-caddy.yml logs -f`
5. **Stop environment** - `./scripts/dev-caddy-stop.sh`

## Performance Tips

### Faster Rebuilds
- Use volume mounts for source files (already configured)
- Don't mount `node_modules` from host
- Use Docker BuildKit for faster builds

### Optimize HMR
- Keep browser DevTools open
- Use `vite --force` to clear cache if needed
- Restart Vite if HMR becomes slow

### Resource Management
```bash
# Clean up unused resources
docker system prune -a

# Remove dangling volumes
docker volume prune
```

## Security Notes

⚠️ **This is a DEVELOPMENT configuration**

- Security headers are RELAXED
- CORS is WIDE OPEN
- Debug mode is ENABLED
- Secrets are in plain text

**DO NOT use this configuration in production!**

For production, use:
- `Caddyfile` (production version)
- `docker-compose.prod.yml`
- Proper secrets management
- Restricted CORS
- Strong security headers

## Next Steps

1. ✅ Development environment ready
2. 🔧 Configure your services in `.env.dev`
3. 🚀 Start coding!
4. 📝 See `TESTING.md` for test setup
5. 🌐 See production deployment docs when ready

## Support

For issues:
1. Check logs: `docker-compose -f docker-compose.dev-caddy.yml logs -f`
2. Verify health: `curl http://localhost/caddy-health`
3. Check service status: `docker-compose -f docker-compose.dev-caddy.yml ps`
4. Review this documentation
5. Check `TROUBLESHOOTING.md`

---

**Happy coding! 🎉**
