# ValueOS Local Development Verification Checklist

## Prerequisites

- Docker Desktop installed and running
- Node.js version matching `.nvmrc`
- Clean git checkout

## ✅ Setup Verification

### 1. Installation

```bash
npm install
# Expected: "added X packages in Ys"
```

### 2. Environment Setup

```bash
npm run env:dev
# Expected: "🔧 Setting up development environment..." + "✅ Updated .env.local with real Supabase keys"
```

### 3. Clean State

```bash
npm run dx:down
# Expected: No containers running, no .dx-lock file
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected: "NAMES     STATUS    PORTS" (empty or no valueos containers)
```

### 4. Start Development Stack

```bash
npm run dx
# Expected: All containers start successfully
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected: valueos-postgres, valueos-redis, valueos-backend, valueos-frontend all "Up X minutes"
```

### 5. Database Connectivity

```bash
curl -sS "http://localhost:54321/rest/v1/" | head -1
# Expected: JSON response or auth error (not connection refused)
```

### 6. Frontend Environment Loading

```bash
node -r dotenv/config -e "console.log('VITE_SUPABASE_ANON_KEY length:', process.env.VITE_SUPABASE_ANON_KEY.length)"
# Expected: "VITE_SUPABASE_ANON_KEY length: 153"
```

### 7. Service Health Checks

```bash
# Backend health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
# Expected: "200"

# Frontend accessibility
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: "200"

# Database ready
docker exec valueos-postgres pg_isready -U postgres
# Expected: "accepting connections"

# Redis ready
docker exec valueos-redis redis-cli ping
# Expected: "PONG"
```

### 8. Database Reset

```bash
npm run db:reset
# Expected: Supabase CLI resets local database successfully
```

### 9. Demo User Creation

```bash
npm run seed:demo
# Expected: "🎉 Demo data seeded successfully!" + login credentials
```

## 🔐 Authentication Verification

### 10. Login Flow

1. Open http://localhost:5173
2. Use credentials from seed:demo output
3. Expected: Successful login, redirect to dashboard

### 11. Session Persistence

```bash
# After login, check API with session
curl -s -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3001/api/user/profile
# Expected: User profile data (200 response)
```

### 12. Tenant Data Access

```bash
# Access tenant-scoped endpoint
curl -s -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3001/api/tenant/projects
# Expected: Projects data (200 response, not 401/403)
```

## 🔄 Repeatable Workflow Verification

### 13. Clean Restart

```bash
npm run dx:down && npm run dx
# Expected: Same results as initial setup
```

### 14. Comprehensive Health Check

```bash
npm run dx:check
# Expected: "🎉 All checks passed! Development environment is ready."
```

## 📋 Troubleshooting Commands

### DX Lock Issues

```bash
# Check lock state
ls -la .dx*
# Clear lock manually
rm -f .dx-lock .dx-state.json
```

### Environment Issues

```bash
# Validate environment
npm run env:validate
# Check current environment
npm run env:status
```

### Port Conflicts

```bash
# Check port usage
lsof -i :54321 -i :54322 -i :5173 -i :3001
# Force restart
npm run dx:reset && npm run dx
```

### Container Issues

```bash
# View logs
npm run dx:logs
# Specific service logs
docker logs valueos-backend
# Restart specific service
docker restart valueos-backend
```

## ✅ Success Criteria

All of the following must pass:

1. ✅ `npm install` succeeds without errors
2. ✅ `npm run dx:down` leaves no relevant containers running
3. ✅ `npm run dx` starts all services successfully
4. ✅ `curl http://localhost:54321/rest/v1/` returns a response (not connection refused)
5. ✅ Frontend loads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` correctly
6. ✅ Login succeeds and session persists across page refreshes
7. ✅ API calls succeed using the session JWT
8. ✅ App loads tenant-scoped data without 401/403 errors
9. ✅ `npm run dx:down && npm run dx` is repeatable with same results
10. ✅ `npm run dx:check` passes all checks

## 🚨 Failure Remediation

If any check fails:

1. **Environment Issues**: Run `npm run env:dev` to reset environment
2. **Container Issues**: Run `npm run dx:clean && npm run dx` for fresh start
3. **Database Issues**: Run `npm run db:reset` to reset database
4. **Port Conflicts**: Check for other services using required ports
5. **Permission Issues**: Ensure Docker daemon is running and user has permissions

## 📝 Notes

- Backend runs on port 3001 (not 3000)
- Supabase API on 54321, Studio on 54323
- Frontend on 5173, PostgreSQL on 5432, Redis on 6379
- All environment variables are validated by `npm run dx:doctor`
- Demo user credentials are displayed after running `npm run seed:demo`
