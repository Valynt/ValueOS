#!/bin/bash
set -euo pipefail

# ValueOS Failsafe Development Setup
# Every step asserts success before proceeding
# Exit code 0 = fully working system
# Exit code != 0 = specific failure with clear message

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DC_CMD="${PROJECT_ROOT}/scripts/dc"

cd "${PROJECT_ROOT}"

log_step() {
  echo -e "${GREEN}[STEP]${NC} $1"
}

log_verify() {
  echo -e "${YELLOW}[VERIFY]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

fail() {
  log_error "$1"
  exit 1
}

version_ge() {
  # returns 0 if $1 >= $2
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# ============================================================================
# STEP 1: Verify Prerequisites
# ============================================================================
log_step "1. Verifying prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node.js v20.x"
command -v npm >/dev/null 2>&1 || fail "npm not found"
command -v docker >/dev/null 2>&1 || fail "Docker not found"

REQUIRED_NODE_VERSION=$(cat .nvmrc 2>/dev/null || cat .config/.nvmrc 2>/dev/null || echo "20.19.0")
REQUIRED_NODE_MAJOR=${REQUIRED_NODE_VERSION%%.*}

NODE_VERSION_FULL=$(node --version | cut -d'v' -f2)
NODE_VERSION_MAJOR=${NODE_VERSION_FULL%%.*}

if [ "$NODE_VERSION_MAJOR" != "$REQUIRED_NODE_MAJOR" ] || ! version_ge "$NODE_VERSION_FULL" "$REQUIRED_NODE_VERSION"; then
  fail "Node.js version mismatch. Expected >=v${REQUIRED_NODE_VERSION} (major ${REQUIRED_NODE_MAJOR}), got v${NODE_VERSION_FULL}"
fi

log_verify "✓ Node.js $(node --version)"
log_verify "✓ npm $(npm --version)"
log_verify "✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ============================================================================
# STEP 2: Clean State
# ============================================================================
log_step "2. Cleaning previous state..."

# Stop any running services
pnpm run dx:down 2>/dev/null || true
pnpm supabase stop --no-backup 2>/dev/null || true

# Kill zombie processes
pkill -9 -f "tsx watch" 2>/dev/null || true
pkill -9 -f "vite --config" 2>/dev/null || true

# Remove generated env files
rm -f .env.local .env.ports deploy/envs/.env.ports

# Remove state files
rm -f .dx-lock .dx-state.json

log_verify "✓ Clean state achieved"

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================
log_step "3. Installing dependencies..."

pnpm install --frozen-lockfile || fail "pnpm install --frozen-lockfile failed - check pnpm-lock.yaml"

log_verify "✓ Dependencies installed from lockfile"

# ============================================================================
# STEP 4: Generate Environment Configuration
# ============================================================================
log_step "4. Generating environment configuration..."

pnpm run env:dev || fail "Environment generation failed"

# Verify critical env vars exist
grep -q "VITE_SUPABASE_ANON_KEY=" .env.local || fail ".env.local missing VITE_SUPABASE_ANON_KEY"
grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env.local || fail ".env.local missing SUPABASE_SERVICE_ROLE_KEY"
grep -q "DATABASE_URL=" .env.local || fail ".env.local missing DATABASE_URL"

log_verify "✓ Environment files generated"
log_verify "✓ Supabase keys present"
log_verify "✓ Database URL configured"

# ============================================================================
# STEP 5: Start Docker Dependencies
# ============================================================================
log_step "5. Starting Docker dependencies..."

"${DC_CMD}" up -d postgres redis || fail "Compose startup failed"

# Wait for health
sleep 3

# Verify Postgres
"${DC_CMD}" exec -T postgres pg_isready -U postgres >/dev/null 2>&1 || fail "Postgres not ready"
log_verify "✓ Postgres ready"

# Verify Redis
"${DC_CMD}" exec -T redis redis-cli ping >/dev/null 2>&1 || fail "Redis not ready"
log_verify "✓ Redis ready"

# ============================================================================
# STEP 6: Start Supabase
# ============================================================================
log_step "6. Starting Supabase local stack..."

pnpm supabase start || fail "Supabase start failed"

# Verify Supabase containers
SUPABASE_CONTAINERS=$(docker ps --filter name=supabase --format "{{.Names}}" | wc -l)
if [ "$SUPABASE_CONTAINERS" -lt 10 ]; then
  fail "Expected 10+ Supabase containers, found $SUPABASE_CONTAINERS"
fi

log_verify "✓ Supabase stack running ($SUPABASE_CONTAINERS containers)"

# ============================================================================
# STEP 7: Database Migrations
# ============================================================================
log_step "7. Applying database migrations..."

pnpm supabase db push || fail "Database migrations failed"

# Verify migrations applied
MIGRATION_STATUS=$(pnpm supabase migration list 2>/dev/null | grep -c "applied" || echo "0")
log_verify "✓ Migrations applied (count: $MIGRATION_STATUS)"

# ============================================================================
# STEP 8: Generate Database Types
# ============================================================================
log_step "8. Generating TypeScript types from schema..."

pnpm run db:types || fail "Type generation failed"

[ -f "src/types/supabase.ts" ] || fail "Generated types file not found"

log_verify "✓ TypeScript types generated"

# ============================================================================
# STEP 9: Seed Demo User
# ============================================================================
log_step "9. Creating demo user..."

pnpm run seed:demo || fail "Demo user seeding failed"

# Verify user exists via direct DB query
USER_EXISTS=$("${DC_CMD}" exec -T postgres psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM auth.users WHERE email='demouser@valynt.com'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "0" ]; then
  fail "Demo user not found in database after seeding"
fi

log_verify "✓ Demo user created: demouser@valynt.com"
log_verify "  Password: passord"
log_verify "  Role: admin"

# ============================================================================
# STEP 10: Start Backend
# ============================================================================
log_step "10. Starting backend server..."

pnpm run backend:dev > /tmp/valueos-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ $WAITED -eq $MAX_WAIT ]; then
  log_error "Backend health check failed after ${MAX_WAIT}s"
  tail -50 /tmp/valueos-backend.log
  fail "Backend did not become healthy"
fi

HEALTH_RESPONSE=$(curl -s http://127.0.0.1:3001/health)
if [ "$HEALTH_RESPONSE" != '{"status":"ok"}' ]; then
  fail "Backend health check returned unexpected response: $HEALTH_RESPONSE"
fi

log_verify "✓ Backend listening on http://127.0.0.1:3001"
log_verify "✓ Health check: $HEALTH_RESPONSE"

# ============================================================================
# STEP 11: Start Frontend
# ============================================================================
log_step "11. Starting frontend dev server..."

pnpm run dev > /tmp/valueos-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend
MAX_WAIT=15
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ $WAITED -eq $MAX_WAIT ]; then
  log_error "Frontend did not start after ${MAX_WAIT}s"
  tail -50 /tmp/valueos-frontend.log
  fail "Frontend did not become accessible"
fi

log_verify "✓ Frontend accessible at http://127.0.0.1:5173"

# ============================================================================
# STEP 12: Automated Authentication Test
# ============================================================================
log_step "12. Testing authentication flow..."

# Login via API
LOGIN_RESPONSE=$(curl -s -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demouser@valynt.com\",\"password\":\"passord\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  log_error "Authentication failed. Response:"
  echo "$LOGIN_RESPONSE" | head -20
  fail "Could not obtain access token for demo user"
fi

log_verify "✓ Authentication successful"
log_verify "✓ Access token obtained (${#ACCESS_TOKEN} chars)"

# Test authenticated endpoint
AUTH_TEST=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://127.0.0.1:3001/api/health)

if [ "$AUTH_TEST" != '{"status":"ok"}' ]; then
  fail "Authenticated request failed: $AUTH_TEST"
fi

log_verify "✓ Authenticated API request successful"

# ============================================================================
# STEP 13: Smoke Test Key Routes
# ============================================================================
log_step "13. Testing key application routes..."

# Test routes (these should return HTML, not 404)
ROUTES=(
  "/"
  "/login"
)

for route in "${ROUTES[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5173$route")
  if [ "$HTTP_CODE" != "200" ]; then
    fail "Route $route returned $HTTP_CODE (expected 200)"
  fi
  log_verify "✓ Route $route: HTTP $HTTP_CODE"
done

# ============================================================================
# SUCCESS
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    SETUP SUCCESSFUL                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Services running:"
echo "  Frontend:        http://localhost:5173"
echo "  Backend:         http://localhost:3001"
echo "  Supabase API:    http://localhost:54321"
echo "  Supabase Studio: http://localhost:54323"
echo ""
echo "Demo credentials:"
echo "  Email:    demouser@valynt.com"
echo "  Password: passord"
echo "  Token:    ${ACCESS_TOKEN:0:20}..."
echo ""
echo "Process IDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "To stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo "  pnpm run dx:down"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/valueos-backend.log"
echo "  Frontend: tail -f /tmp/valueos-frontend.log"
echo ""
