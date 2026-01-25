# ValueOS System Invariants

**Purpose**: Document the contracts that must never change for reproducibility.

---

## 1. Demo User Contract

### Fixed Credentials

```
Email:    demo@valueos.dev
Password: Demo123!@#
UUID:     00000000-0000-0000-0000-000000000001 (deterministic)
```

### Invariants

- Email must never change (used in docs, tests, scripts)
- Password must never change (hardcoded in verification scripts)
- UUID must be fixed (prevents duplicate creation)
- Role must be `admin` (full permissions for testing)

### Seeding Behavior

- **Idempotent**: Can run multiple times without errors
- **Implementation**: Uses `ON CONFLICT (email) DO UPDATE` or `INSERT ... ON CONFLICT DO NOTHING`
- **Script**: `scripts/seed-demo-user.ts`

---

## 2. Port Assignments

### Source of Truth

**File**: `config/ports.json`

### Fixed Ports

```json
{
  "frontend": { "port": 5173, "hmrPort": 24678 },
  "backend": { "port": 3001 },
  "postgres": { "port": 5432 },
  "redis": { "port": 6379 },
  "supabase": { "apiPort": 54321, "studioPort": 54323 }
}
```

### Supabase Local Ports (from config.toml)

```
API:    54321
Studio: 54323
DB:     54329  (NOT 54322 - changed to avoid conflicts)
```

### Invariants

- Ports must not conflict
- Changes to `ports.json` must regenerate `.env.ports`
- Supabase DB port `54329` is intentional (not a typo)

---

## 3. Environment Variables

### Required for Backend

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<fixed-demo-key>
SUPABASE_SERVICE_ROLE_KEY=<fixed-demo-key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Required for Frontend

```bash
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<fixed-demo-key>
```

### Fixed Demo Keys (Safe for Local Dev)

```bash
# Anon Key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Service Role Key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Invariants

- Keys must match Supabase local dev defaults
- Missing required vars must crash immediately (not degrade)
- No production secrets in local dev

---

## 4. Database Reset Behavior

### Command

```bash
npx supabase db reset
```

### Behavior

1. Drops all tables
2. Recreates schema from migrations
3. Runs seed files (if configured)
4. Generates fresh types

### Invariants

- Must be idempotent (can run multiple times)
- Must not require manual intervention
- Must produce identical schema every time

---

## 5. Migration Contract

### Location

`supabase/migrations/*.sql`

### Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

### Invariants

- Migrations are append-only (never edit existing)
- Each migration must be idempotent where possible
- Migrations run in lexical order
- Already-applied migrations are skipped

---

## 6. Authentication Flow

### Login Endpoint

```
POST http://localhost:54321/auth/v1/token?grant_type=password
```

### Required Headers

```
apikey: <VITE_SUPABASE_ANON_KEY>
Content-Type: application/json
```

### Request Body

```json
{
  "email": "demo@valueos.dev",
  "password": "Demo123!@#"
}
```

### Expected Response

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "<refresh-token>",
  "user": { ... }
}
```

### Invariants

- Demo user must authenticate successfully
- Token must be valid for at least 1 hour
- Token must grant access to protected endpoints

---

## 7. Health Check Contract

### Backend Health

```bash
curl http://127.0.0.1:3001/health
```

**Expected**:

```json
{ "status": "ok" }
```

### Invariants

- Must return 200 OK
- Must not require authentication
- Must respond within 1 second

---

## 8. DevContainer-Specific Behaviors

### Port Forwarding

- VS Code auto-forwards ports when accessed
- Initial connection may take 5-10 seconds
- Direct `localhost` access from shell may fail (use `127.0.0.1`)

### HMR (Hot Module Reload)

- **Disabled** in DevContainer environments
- Reason: WebSocket port forwarding unreliable
- Impact: Manual browser refresh required after code changes

### Dependency Checks

- **Skipped** in development mode
- Reason: Health checks hang on port forwarding delays
- Impact: App loads immediately without waiting for services

### IPv6 vs IPv4

- All services bind to `127.0.0.1` (IPv4) explicitly
- Reason: Avoid IPv6 resolution issues in containers

---

## 9. Build Determinism

### No Timestamps

- `.env.local`: No generation timestamp
- Build artifacts: Timestamps allowed (not committed)
- Lock files: Timestamps ignored

### Fixed Seeds

- All random data generation uses fixed seeds
- UUIDs use deterministic generation where possible
- Timestamps use fixed values in test data

### Lockfiles

- `pnpm-lock.yaml`: Committed, must not drift
- Docker image tags: Pinned in `docker-compose.yml`
- Supabase version: Pinned in `supabase/config.toml`

---

## 10. Failure Modes

### Expected Failures (Non-Breaking)

- Redis connection warnings in DevContainer (retries work)
- Billing features disabled (Stripe not configured)
- CORS warnings in development (expected)

### Unexpected Failures (Breaking)

- Backend crashes on startup
- Supabase containers not starting
- Demo user authentication fails
- Health checks return non-200

### Debugging Contract

- All errors must include actionable fix
- Logs must identify the failing component
- Exit codes must be non-zero on failure

---

## Verification Commands

Run these to verify invariants hold:

```bash
# 1. Check demo user exists
docker exec valueos-postgres psql -U postgres -d postgres -c \
  "SELECT email, id FROM auth.users WHERE email='demo@valueos.dev'"

# 2. Verify port configuration
grep -E "port.*:" config/ports.json

# 3. Check Supabase keys in env
grep SUPABASE .env.local | grep -v "^#"

# 4. Verify migrations applied
npx supabase migration list

# 5. Test authentication
curl -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@valueos.dev","password":"Demo123!@#"}' | jq .access_token

# 6. Verify health
curl http://127.0.0.1:3001/health
```

All commands must succeed for the system to be considered operational.

---

## Change Management

### When Changing Invariants

1. **Update this document first**
2. Update all scripts that depend on the invariant
3. Update tests
4. Update documentation
5. Verify golden path still passes

### Examples

**Changing demo user password**:

- Update `SYSTEM_INVARIANTS.md`
- Update `scripts/seed-demo-user.ts`
- Update `scripts/setup-dev-failsafe.sh`
- Update `scripts/verify-golden-path.sh`
- Update `docs/dev/REPRODUCIBLE_DEV_SETUP.md`
- Run `bash scripts/verify-golden-path.sh`

**Changing ports**:

- Update `config/ports.json`
- Run `pnpm run env:dev`
- Update any hardcoded references
- Restart all services

---

## Contract Violations

If any of these invariants are violated, the system is **broken**:

- ❌ Demo user credentials changed without updating all scripts
- ❌ Ports changed without regenerating env files
- ❌ Migrations edited after being applied
- ❌ Environment variables missing without validation
- ❌ Health checks return success while services are down
- ❌ Seed scripts create duplicates on re-run
- ❌ Setup script succeeds but app doesn't work

**Enforcement**: CI must run `verify-golden-path.sh` on every commit.
