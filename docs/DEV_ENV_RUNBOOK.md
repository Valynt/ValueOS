# Dev Environment Runbook

## Prerequisites

- Node.js 20+ (v22.22.0 installed)
- npm 10.9.4
- Python 3.11.14
- Docker 29.1.4 with Docker Compose
- Supabase CLI (installed locally via npm)

## Setup Steps

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npx supabase start` to start local Supabase
4. Run `pnpm run dx` to start the development stack
5. Run `pnpm run dx:check` to verify health
6. Run `npx supabase db reset` to apply migrations
7. Run `npm run seed:demo` to create demo user
8. Open http://localhost:5173 and login with demo.user@example.com / DemoUser!2345

## Exact Commands to Boot Stack

```bash
npx supabase start
pnpm run dx
pnpm run dx:check
npx supabase db reset
npm run seed:demo
```

## Health Check Steps

1. Run `pnpm run dx:check` for comprehensive checks
2. Check backend API at http://localhost:3001/health
3. Check Supabase API at http://localhost:54321
4. Check Supabase Studio at http://localhost:54323
5. Check frontend at http://localhost:5173

## Migration/Seed Commands

- Migrations: `npx supabase db reset`
- Seed: `npm run seed:demo`

## Dummy User Creation Steps

1. Ensure Supabase is running: `npx supabase start`
2. Reset database: `npx supabase db reset`
3. Run seed script: `npm run seed:demo`
4. User created: demo.user@example.com / DemoUser!2345

## UI Login Validation Steps

1. Open http://localhost:5173 in browser
2. Go to Sign In
3. Enter demo.user@example.com / DemoUser!2345
4. Verify authenticated landing page
5. Check session persistence and API access

## Common Failures + Fixes

- **Supabase not running**: Run `npx supabase start` first, check with `npx supabase status`
- **Backend crashes**: Ensure SUPABASE_SERVICE_ROLE_KEY is set correctly
- **Health checks fail**: Update .env.local with local Supabase keys from `npx supabase status`
- **Port conflicts**: Use `DX_ALLOW_PORT_IN_USE=1 pnpm run dx`
- **Seed fails**: Ensure Supabase API is accessible at http://localhost:54321
- **Auth errors**: Check VITE_SUPABASE_ANON_KEY matches local keys
- **Database errors**: Run `npx supabase db reset` after Supabase starts
