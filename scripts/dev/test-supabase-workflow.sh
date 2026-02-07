#!/usr/bin/env bash
set -euo pipefail

# Local E2E Supabase workflow test
# - Ensures env is generated
# - Starts dev environment (local Supabase + services) with demo seed
# - Waits for services to become healthy
# - Runs headless login verification (scripts/verify-login.ts)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Configurable timeouts
FRONTEND_TIMEOUT=${FRONTEND_TIMEOUT:-60}
BACKEND_TIMEOUT=${BACKEND_TIMEOUT:-60}
DB_TIMEOUT=${DB_TIMEOUT:-90}

log() {
  local level="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
}

ensure_prereqs() {
  command -v pnpm >/dev/null 2>&1 || { echo "pnpm required. Install pnpm."; exit 1; }
  command -v docker >/dev/null 2>&1 || { echo "Docker required. Install Docker."; exit 1; }
}

ensure_env() {
  # Generate .env.local if missing or to force update
  if [[ ! -f ".env.local" ]]; then
    log INFO "Generating .env.local (local mode)"
    pnpm run dx:env --mode local --force
  fi

  # Ensure demo password default
  export DEMO_USER_PASSWORD="${DEMO_USER_PASSWORD:-passord}"

  # Validate critical vars
  if ! grep -q "VITE_SUPABASE_URL" .env.local || ! grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
    log ERROR "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local. Run 'pnpm run dx:env --mode local --force'"
    exit 1
  fi
}

start_dev_env() {
  log INFO "Starting development environment (local Supabase + services) with seed"
  # This will start services, run migrations, and seed demo data due to --seed
  pnpm run dx:up --seed
}

wait_for() {
  local name=$1; local url=$2; local timeout=$3; local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      log SUCCESS "$name is healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
  done
  echo
  log ERROR "$name did not become healthy within ${timeout}s"
  return 1
}

run_verification() {
  log INFO "Running headless verification: scripts/verify-login.ts"
  # Use pnpm exec tsx if available for consistent environment
  if pnpm -v >/dev/null 2>&1; then
    pnpm exec -- tsx scripts/verify-login.ts
  else
    tsx scripts/verify-login.ts
  fi
}

# ------- Main Flow -------
ensure_prereqs
ensure_env

# Start dev environment
start_dev_env

# Wait for services: DB via pg_isready (docker), backend and frontend
log INFO "Waiting for Postgres to be ready"
# Use docker-compose health check via scripts/dc wrapper when available
if [[ -x "scripts/dc" ]]; then
  # Try to detect postgres service name from start script
  # Fallback to host check
  scripts/dc exec -T postgres pg_isready -U postgres >/dev/null 2>&1 || true
fi

log INFO "Waiting for backend (http://localhost:3001/health)"
wait_for "Backend" "http://localhost:3001/health" $BACKEND_TIMEOUT

log INFO "Waiting for frontend (http://localhost:5173/)"
wait_for "Frontend" "http://localhost:5173/" $FRONTEND_TIMEOUT

# Run verification
if run_verification; then
  log SUCCESS "Headless verification passed — demo login successful"
else
  log ERROR "Verification failed"
  exit 1
fi

log SUCCESS "Local E2E Supabase workflow test completed successfully"

# Print helpful note
cat <<EOF
🎉 All done!
- Frontend: http://localhost:5173
- Backend:  http://localhost:3001
- Supabase API: ${VITE_SUPABASE_URL:-http://localhost:54321}

Demo credentials used (env override supported):
  Email:    demouser@valynt.com
  Password: ${DEMO_USER_PASSWORD}

To stop the dev environment: pnpm run dx:down
EOF
