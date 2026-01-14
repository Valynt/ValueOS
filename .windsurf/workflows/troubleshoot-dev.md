---
description: Diagnose and fix development environment issues
---

# Dev Environment Troubleshooting Workflow

## Quick Diagnostics

// turbo

1. Check overall dev environment health:

```bash
npm run dev:health
```

// turbo 2. Diagnose network issues:

```bash
npm run dev:diagnose
```

// turbo 3. Test ports are available:

```bash
npm run dev:test-ports
```

## Common Fixes

4. Auto-fix common issues:

```bash
npm run dev:auto-fix
```

5. Fix port forwarding issues:

```bash
npm run dev:fix
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
npm install
npx supabase start
npm run dev
```

## Environment Variables

12. Verify env vars are set:

```bash
cat .env.local | grep -E "^[A-Z]" | head -20
```
