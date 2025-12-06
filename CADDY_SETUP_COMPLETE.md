# ✅ Caddy Development Setup - Complete

## What's Been Created

### 📁 Configuration Files

1. **Caddyfile.dev** (6.0K)
   - Development-optimized Caddy configuration
   - Debug logging enabled
   - Relaxed security for development
   - WebSocket support for HMR
   - Request size limit: 100MB
   - Extended timeouts for debugging

2. **.env.dev.example** (3.4K)
   - Complete environment variable template
   - Database credentials
   - Redis configuration
   - Feature flags
   - Development defaults

### 🐳 Docker Configuration

3. **docker-compose.dev-caddy.yml** (5.9K)
   - Complete development stack
   - Services: Caddy, App, PostgreSQL, Redis
   - Health checks configured
   - Volume mounts for hot reload
   - Network isolation
   - Resource limits

### 🔧 Scripts

4. **scripts/dev-caddy-start.sh** (5.2K)
   - Automated startup script
   - Dependency checking
   - Health verification
   - Beautiful CLI output
   - Interactive log following

5. **scripts/dev-caddy-stop.sh** (1.4K)
   - Clean shutdown
   - Optional volume removal
   - User-friendly prompts

### 📚 Documentation

6. **DEV_CADDY_SETUP.md** (6.3K)
   - Complete setup guide
   - Troubleshooting section
   - Admin API usage
   - Development workflow
   - Performance tips

7. **README_DEV_QUICK_START.md** (2.0K)
   - 2-minute quick start
   - Essential commands
   - Common issues

## Architecture Overview

```

                 Developer                        │
                    ↓                             │
         http://localhost (Port 80)              │

                      │
            {                 echo ___BEGIN___COMMAND_OUTPUT_MARKER___;                 PS1="";PS2="";                 EC=$?;                 echo "___BEGIN___COMMAND_DONE_MARKER___$EC";             }
            Caddy Reverse Proxy                   │
  • Automatic routing                             │
  • WebSocket upgrade                             │
  • CORS handling                                 │
  • Compression                                   │
  • Request tracing                               │

     │             │              │
     ▼             ▼              ▼
  ┌──────────┐  ┌──────────┐
  Vite   │  │PostgreSQL│  │  Redis   │
  :3000  │  │  :5432   │  │  :6379   │
         │  │          │  │          │
   HMR   │  │ Database │  │  Cache   │
  └──────────┘  └──────
```

## Key Features

### 🚀 Development Optimizations

- **Hot Module Replacement** - Instant code updates
- **Debug Logging** - Detailed request/response logs
- **Extended Timeouts** - 60s for debugging
- **Large Uploads** - 100MB request limit
- **Auto Restart** - Services restart on failure

### 🔒 Security (Development Mode)

- **Relaxed CSP** - Allows inline scripts/styles
- **Open CORS** - Accepts all origins
- **No HTTPS** - HTTP only for localhost
- **Debug Headers** - X-Dev-Mode header added

### 🎯 Access Points

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Caddy Proxy | 80 | http://localhost | Main application |
| Vite Dev | 3000 | http://localhost:3000 | Direct dev server |
| Static Server | 8080 | http://localhost:8080 | Built files |
| Admin API | 2019 | http://localhost:2019 | Caddy config |
| PostgreSQL | 5432 | localhost:5432 | Database |
| Redis | 6379 | localhost:6379 | Cache |
| HMR WebSocket | 24678 | ws://localhost:24678 | Hot reload |

## Quick Start Commands

```bash
# First time setup
cp .env.dev.example .env.dev
./scripts/dev-caddy-start.sh

# Daily workflow
./scripts/dev-caddy-start.sh              # Start
# ... code changes happen here ...
./scripts/dev-caddy-stop.sh               # Stop

# View logs
docker-compose -f docker-compose.dev-caddy.yml logs -f

# Restart service
docker-compose -f docker-compose.dev-caddy.yml restart app

# Rebuild everything
docker-compose -f docker-compose.dev-caddy.yml up -d --build
```

## Caddy Admin API Examples

```bash
# View current configuration
curl http://localhost:2019/config/ | jq

# Reload configuration
caddy reload --config Caddyfile.dev --adapter caddyfile

# Check specific route
curl http://localhost:2019/config/apps/http/servers

# Health check
curl http://localhost/caddy-health
```

## Environment Variables

### Required (in .env.dev)

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_LLM_API_KEY` - LLM provider API key

### Optional (have defaults)

- `POSTGRES_PASSWORD` - Default: dev_password_change_me
- `REDIS_PASSWORD` - Default: dev_redis_password
- `VITE_LLM_PROVIDER` - Default: together

## Development Workflow

1. **Start Environment**
   ```bash
   ./scripts/dev-caddy-start.sh
   ```

2. **Verify Services**
   - Check http://localhost (should load app)
   - Check http://localhost/caddy-health (should return "Caddy is healthy")
   - Check logs for any errors

3. **Development Loop**
   - Edit files in `./src/`
   - Save changes
   - Browser automatically reloads
   - Check logs if needed

4. **Stop Environment**
   ```bash
   ./scripts/dev-caddy-stop.sh
   ```

## Troubleshooting

### Port 80 Already in Use

```bash
# Find process using port 80
lsof -i :80

# Kill it (if safe)
kill -9 <PID>

# Or change port in docker-compose.dev-caddy.yml
# "8000:80" instead of "80:80"
# Then access at http://localhost:8000
```

### Caddy Not Starting

```bash
# Validate Caddyfile
caddy validate --config Caddyfile.dev --adapter caddyfile

# Check Docker logs
docker logs valuecanvas-caddy-dev

# Restart Caddy
docker-compose -f docker-compose.dev-caddy.yml restart caddy
```

### HMR Not Working

```bash
# Check Vite is running
curl http://localhost:3000

# Check WebSocket port
curl http://localhost:24678

# Restart app
docker-compose -f docker-compose.dev-caddy.yml restart app

# Clear browser cache
# Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
```

### Database Connection Failed

```bash
# Check PostgreSQL
docker exec valuecanvas-postgres-dev pg_isready -U valuecanvas

# View database logs
docker-compose -f docker-compose.dev-caddy.yml logs postgres

# Connect manually
docker exec -it valuecanvas-postgres-dev psql -U valuecanvas -d valuecanvas_dev
```

### Redis Connection Failed

```bash
# Check Redis
docker exec valuecanvas-redis-dev redis-cli -a dev_redis_password ping

# View Redis logs
docker-compose -f docker-compose.dev-caddy.yml logs redis

# Connect manually
docker exec -it valuecanvas-redis-dev redis-cli -a dev_redis_password
```

## Performance Tips

### Optimize Docker

```bash
# Prune unused resources
docker system prune -a

# Remove dangling volumes
docker volume prune

# Restart Docker Desktop
```

### Optimize Vite

- Keep browser DevTools closed when not debugging
- Use `vite --force` to clear cache
- Limit number of watched files
- Close unused browser tabs

### Optimize Caddy

- Reduce log level to INFO in production
- Enable caching for static assets
- Use compression for large responses

## Security Notes

 **THIS IS A DEVELOPMENT CONFIGURATION**

**DO NOT use in production:**
- Secrets are in plain text
- Security headers are relaxed
- CORS is wide open
- Debug mode is enabled
- Extended timeouts
- Large upload limits

For production, use:
- `Caddyfile` (hardened version)
- `docker-compose.prod.yml`
- Proper secrets management
- Environment-specific configs

## Next Steps

1. ✅ **Development setup complete**
2. 🔑 Configure `.env.dev` with your API keys
3. 🚀 Start development: `./scripts/dev-caddy-start.sh`
4. 💻 Start coding in `./src/`
5. 🧪 Run tests (see `TESTING.md`)
6. 📦 Build for production (see production docs)

## File Locations

```
/workspaces/ValueCanvas/
 Caddyfile.dev                    # Caddy config for dev
 docker-compose.dev-caddy.yml     # Docker compose for dev
 .env.dev.example                 # Environment template
 scripts/
   ├── dev-caddy-start.sh          # Start script
   └── dev-caddy-stop.sh           # Stop script
 DEV_CADDY_SETUP.md              # Full documentation
 README_DEV_QUICK_START.md       # Quick start guide
```

## Support

For help:
1. Check `DEV_CADDY_SETUP.md` (detailed docs)
2. Check `README_DEV_QUICK_START.md` (quick reference)
3. View logs: `docker-compose -f docker-compose.dev-caddy.yml logs -f`
4. Check service health: `docker-compose -f docker-compose.dev-caddy.yml ps`

---

**🎉 Your development environment is ready!**

Start with: `./scripts/dev-caddy-start.sh`

Happy coding! 💻✨
