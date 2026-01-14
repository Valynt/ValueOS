# Fix Local Development Setup

This plan resolves the local development environment issues to enable working login functionality.

## Current Issues Identified

1. **DX lock mismatch**: Current lock shows local mode but containers aren't running
2. **Missing Supabase keys**: Both `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY` have placeholder values
3. **Wrong key source**: Using `supabase status` won't work - DX uses docker-compose, not Supabase CLI
4. **Environment split**: `.env.local` for app runtime, compose needs keys in container environment

## Key Discovery

Found the actual local Supabase anon key in test files:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## Environment Architecture

DX uses docker-compose with `--env-file deploy/envs/.env.ports`, so:

- **App runtime**: `.env.local` (loaded by Vite/frontend)
- **Container runtime**: `.env.ports` + compose env vars
- **Backend container**: Needs `SUPABASE_ANON_KEY` from compose environment
- **Frontend container**: Needs `VITE_SUPABASE_ANON_KEY` from compose environment

## Step-by-Step Fix Plan

### 1. Clear DX Lock and Stop Partial State

```bash
npm run dx:down
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'supabase|postgres|value|dx' || true
```

### 2. Update App Environment (.env.local)

Set real keys for frontend/backend when running outside containers:

```bash
# Update /home/ino/ValueOS/.env.local
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 3. Update Container Environment (.env.ports)

Add keys for containers (compose reads this file):

```bash
# Add to /home/ino/ValueOS/deploy/envs/.env.ports
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 4. Start Development Environment

```bash
npm run dx
```

### 5. Reset Local Database

Use correct command for local development:

```bash
npm run db:reset
```

### 6. Verify Environment Loading

```bash
node -e "console.log('VITE_SUPABASE_URL=', process.env.VITE_SUPABASE_URL); console.log('VITE_SUPABASE_ANON_KEY=', (process.env.VITE_SUPABASE_ANON_KEY||'').slice(0,12)+'...')"
```

### 7. Test Supabase Connectivity

```bash
curl -sS "http://localhost:54321/rest/v1/" | head
```

### 8. Restart Clean (if needed)

```bash
npm run dx:down
npm run dx
```

## Expected End State

- Services running at:
  - UI: `http://localhost:5173`
  - Backend: `http://localhost:3001`
  - Supabase Studio: `http://localhost:54323`
- Login functionality working with real Supabase anon key
- Database properly initialized with migrations
- Both app and containers have correct environment variables

## Troubleshooting Checks

If login still fails:

1. **Check environment loading**: Verify frontend reads the keys (step 6)
2. **Check Supabase connectivity**: Verify endpoint responds (step 7)
3. **Check RLS policies**: May need seed/demo user for local development
4. **Check container env**: Ensure containers receive the anon key via .env.ports

## Critical Notes

- **DX uses docker-compose**, not Supabase CLI - keys come from env files, not `supabase status`
- **Environment split**: `.env.local` for local dev, `.env.ports` for containers
- **Backend port**: 3001 (not 3000) as shown in DX Doctor output
- **Database command**: Use `db:reset` for local, not `db:push` (which is for remote projects)
