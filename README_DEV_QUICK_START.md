# 🚀 ValueCanvas Development - Quick Start

Get up and running in 2 minutes!

## Prerequisites

- Docker Desktop installed and running
- Git repository cloned

## Start Development (3 Commands)

```bash
# 1. Copy environment file
cp .env.dev.example .env.dev

# 2. Start all services with Caddy
./scripts/dev-caddy-start.sh

# 3. Open your browser
open http://localhost
```

That's it! 🎉

## What You Get

- ✅ **Vite dev server** with Hot Module Replacement
- ✅ **Caddy reverse proxy** on port 80
- ✅ **PostgreSQL** database
- ✅ **Redis** cache
- ✅ **Auto-reload** on file changes

## Access Points

| What | Where |
|------|-------|
| Application | http://localhost |
| Vite Direct | http://localhost:3000 |
| Static Files | http://localhost:8080 |
| Caddy Admin | http://localhost:2019 |
| Database | localhost:5432 |
| Redis | localhost:6379 |

## Common Commands

```bash
# View logs
docker-compose -f docker-compose.dev-caddy.yml logs -f

# Stop everything
./scripts/dev-caddy-stop.sh

# Restart a service
docker-compose -f docker-compose.dev-caddy.yml restart app

# Rebuild
docker-compose -f docker-compose.dev-caddy.yml up -d --build
```

## Edit and See Changes

1. Edit any file in `./src/`
2. Save the file
3. Browser auto-refreshes! ⚡

## Troubleshooting

**Port 80 already in use?**
```bash
# Find what's using it
lsof -i :80

# Or change Caddy port in docker-compose.dev-caddy.yml
# Change "80:80" to "8000:80"
# Then access at http://localhost:8000
```

**Services not starting?**
```bash
# Check logs
docker-compose -f docker-compose.dev-caddy.yml logs

# Clean restart
docker-compose -f docker-compose.dev-caddy.yml down -v
./scripts/dev-caddy-start.sh
```

## Next Steps

- Configure Supabase keys in `.env.dev`
- Read full setup guide: `DEV_CADDY_SETUP.md`
- Check testing guide: `TESTING.md`
- Production deployment: `DEPLOYMENT_GUIDE.md`

---

Need help? Check `DEV_CADDY_SETUP.md` for detailed documentation.
