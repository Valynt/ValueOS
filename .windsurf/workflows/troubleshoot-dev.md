---
description: Diagnose and fix development environment issues
---

# Dev Environment Troubleshooting Workflow

## Quick Diagnostics

// turbo

1. Check overall dev environment health:

```bash
pnpm run dx:doctor
```

// turbo 2. Diagnose network issues:

```bash
# Check if services are running on expected ports
curl -s http://localhost:5173 || echo "Frontend not running"
curl -s http://localhost:54321/rest/v1/ || echo "Supabase not running"
```

// turbo 3. Test ports are available:

```bash
netstat -tlnp | grep -E ':5173|:54321|:3001' || echo "Check ports"
```

## Common Fixes

4. Auto-fix common issues:

```bash
bash scripts/cleanup.sh
```

5. Fix port forwarding issues:

```bash
# Restart services
pnpm run dx:down
pnpm run dx:up
```

## Supabase Issues

6. Check Supabase status:

```bash
npx supabase status
```

7. If Supabase is down, restart:

```bash
npx supabase stop
npx supabase start
```

8. Reset Supabase completely (if corrupted):

```bash
npx supabase db reset
```

## Docker Issues

9. Check Docker containers:

```bash
docker ps -a
```

10. Restart Docker services:

```bash
docker-compose down
docker-compose up -d
```

## Nuclear Option

11. Full cleanup and restart:

```bash
bash scripts/cleanup.sh
pnpm install
npx supabase start
pnpm --filter valynt-app run dev
```

## Environment Variables

12. Verify env vars are set:

```bash
cat .env.local | grep -E "^[A-Z]" | head -20
```
