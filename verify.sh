#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# verify-dev-env.sh
#
# Purpose:
#   Machine-check the local dev environment end-to-end:
#   - Required tools present
#   - Node/npm versions match
#   - Docker available
#   - .env.local provides Supabase URL + anon key (+ service role key for seeding)
#   - Supabase API becomes ready
#   - Postgres accepts connections (if psql available)
#   - Migrations run (if migrations directory exists)
#   - Demo user seeded (idempotent)
#   - Demo user can login and obtain an access token
#   - Demo user can access profile endpoint
#   - Writes machine-readable result JSON to verify.result.json
#
# Notes:
#   - This script is designed to be idempotent and safe to re-run.
#   - Seeding requires SUPABASE_SERVICE_ROLE_KEY.
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULT_FILE="${SCRIPT_DIR}/verify.result.json"

# Pinned versions (can be overridden via env, read from .nvmrc if available)
DEFAULT_NODE_VERSION="18.19.0"
if [[ -f "${SCRIPT_DIR}/.nvmrc" ]]; then
  DEFAULT_NODE_VERSION="$(tr -d '[:space:]' < "${SCRIPT_DIR}/.nvmrc")"
fi
NODE_VERSION="${NODE_VERSION:-$DEFAULT_NODE_VERSION}"
NPM_VERSION="${NPM_VERSION:-9.2.0}"

readonly DEMO_USER_EMAIL="${DEMO_USER_EMAIL:-demo.user@example.com}"
readonly DEMO_USER_PASSWORD="${DEMO_USER_PASSWORD:-DemoPassword123!}"

# Database / Supabase defaults (can be overridden via env)
readonly SUPABASE_URL_DEFAULT="http://localhost:54321"
readonly DB_HOST_DEFAULT="localhost"
readonly DB_PORT_DEFAULT="5432"
readonly DB_USER_DEFAULT="postgres"
readonly DB_PASS_DEFAULT="dev_password"
readonly DB_NAME_DEFAULT="app_db"

# Runtime outputs
VERIFY_AUTH_TOKEN=""
VERIFY_USER_ID=""
DEMO_USER_ID=""

###############################################################################
# Logging helpers
###############################################################################

_ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

json_string() { printf '%s' "$1" | jq -Rs '.'; }

info()    { echo "[$(_ts)] [INFO]  $*"; }
warn()    { echo "[$(_ts)] [WARN]  $*" >&2; }
success() { echo "[$(_ts)] [OK]    $*"; }

fail() {
  local msg="$*"
  echo "{\"status\":\"failed\",\"error\":$(json_string "$msg"),\"timestamp\":\"$(_ts)\"}" > "$RESULT_FILE"
  echo "[$(_ts)] [FAIL]  $msg" >&2
  exit 1
}

###############################################################################
# Step 0: Required tools
###############################################################################

step_tools() {
  info "Step 0: Checking required tools..."

  local required=(jq curl)
  for t in "${required[@]}"; do
    command -v "$t" >/dev/null 2>&1 || fail "${t} is required \(install via apt-get/brew\)"
  done

  success "Required tools available"
}

###############################################################################
# Step 1: Enforce Node/npm/Docker
###############################################################################

step_enforce_versions() {
  info "Step 1: Enforcing Node/npm versions and Docker availability..."

  command -v node >/dev/null 2>&1 || fail "node is required"
  command -v npm  >/dev/null 2>&1 || fail "npm is required"

  local node_version
  node_version="$(node -v || true)"
  [[ "$node_version" == "v${NODE_VERSION}" ]] || fail "Node ${NODE_VERSION} required, found ${node_version}"

  local npm_version
  npm_version="$(npm -v || true)"
  [[ "$npm_version" == "${NPM_VERSION}" ]] || fail "npm ${NPM_VERSION} required, found ${npm_version}"

  command -v docker >/dev/null 2>&1 || fail "docker is required (install Docker Desktop / Docker Engine first)"
  docker info >/dev/null 2>&1 || fail "docker is installed but not running / not accessible"

  success "Node/npm versions and Docker verified"
}

###############################################################################
# Step 2: Load environment (.env.local)
###############################################################################

step_load_env() {
  info "Step 2: Loading environment from .env.local..."

  local env_file="${ENV_FILE:-${SCRIPT_DIR}/.env.local}"
  [[ -f "$env_file" ]] || fail "Missing .env.local at: ${env_file}"

  # shellcheck disable=SC1090
  set -a
  source "$env_file" 2>/dev/null || fail "Failed to source ${env_file}"
  set +a

  # Required Supabase env
  [[ -n "${VITE_SUPABASE_URLS_url:-""}" ]] && warn "It looks like you have a typo env var 'VITE_SUPABASES_url'. Ignoring."

  [[ -n "${VITE_SUPABASE_URL:-""}" ]] || fail "VITE_SUPABASE_URL is not set in .env.local"
  [[ -n "${VITE_SUPABASE_ANON_KEY:-""}" ]] || fail "VITE_SUPABASE_ANON_KEY is not set in .env.local"

  success "Environment loaded and required vars present"
}

###############################################################################
# Step 3: Verify Supabase is up
###############################################################################

step_verify_supabase_ready() {
  info "Step 3: Verifying Supabase API becomes ready..."

  command -v supabase >/dev/null 2>&1 || warn "supabase CLI not found (optional)"

  local supabase_url="${VITE_SUPABASE_URL:-$SUPABASE_URL_DEFAULT}"

  local max_attempts="${SUPABASE_READY_MAX_ATTEMPTS:-40}"
  local sleep_s="${SUPABASE_READY_SLEEP_S:-2}"

  local attempt=1
  while (( attempt <= max_attempts )); do
    if curl -fsS --connect-timeout 5 "${supabase_url}/auth/v1/settings" >/dev/null 2>&1; then
      success "Supabase API is reachable at ${supabase_url}"
      return 0
    fi
    info "Waiting for Supabase API (${attempt}/${max_attempts})..."
    sleep "${sleep_s}"
    attempt=$((attempt + 1))
  done

  fail "Supabase API did not become ready after ${max_attempts} attempts (${supabase_url})"
}

###############################################################################
# Step 4: Verify Postgres connectivity (optional unless enforced)
###############################################################################

step_verify_postgres() {
  info "Step 4: Verifying Postgres connectivity..."

  local db_host="${DB_HOST:-$DB_HOST_DEFAULT}"
  local db_port="${DB_PORT:-$DB_PORT_DEFAULT}"
  local db_user="${DB_USER:-$DB_USER_DEFAULT}"
  local db_pass="${DB_PASS:-$DB_PASS_DEFAULT}"

  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$db_pass" psql -h "$db_host" -U "$db_user" -p "$db_port" -d postgres -c "SELECT 1;" >/dev/null 2>&1 \
      || fail "Postgres is not accepting connections on ${db_host}:${db_port}"
    success "Postgres accepting connections"
  else
    if [[ "${REQUIRE_PSQL:-0}" == "1" ]]; then
      fail "psql is required but not found (install postgresql client tools)"
    fi
    warn "psql not available; skipping Postgres connectivity check"
  fi
}

###############################################################################
# Step 5: Ensure app database exists + run migrations (best-effort)
###############################################################################

step_db_migrations() {
  info "Step 5: Ensuring database exists and running migrations (if present)..."

  local db_host="${DB_HOST:-$DB_HOST_DEFAULT}"
  local db_port="${DB_PORT:-$DB_PORT_DEFAULT}"
  local db_user="${DB_USER:-$DB_USER_DEFAULT}"
  local db_pass="${DB_PASS:-$DB_PASS_DEFAULT}"
  local db_name="${DB_NAME:-$DB_NAME_DEFAULT}"

  if ! command -v psql >/dev/null 2>&1; then
    warn "psql not available; skipping DB creation + migrations"
    return 0
  fi

  # Create DB if missing
  if ! PGPASSWORD="$db_pass" psql -h "$db_host" -U "$db_user" -p "$db_port" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}';" | grep -q 1; then
    info "Database '${db_name}' not found; creating..."
    PGPASSWORD="$db_pass" psql -h "$db_host" -U "$db_user" -p "$db_port" -d postgres -c "CREATE DATABASE \"${db_name}\";" >/dev/null 2>&1 \
      || fail "Failed to create database: ${db_name}"
    success "Database created: ${db_name}"
  else
    info "Database exists: ${db_name}"
  fi

  # Run migrations if present (optional for v1)
  local migrations_dir="${MIGRATIONS_DIR:-${SCRIPT_DIR}/migrations}"
  if [[ -d "$migrations_dir" ]]; then
    local migration_count=0
    shopt -s nullglob
    for migration in "$migrations_dir"/*.sql; do
      info "Applying migration: $(basename "$migration")"
      PGPASSWORD="$db_pass" psql -h "$db_host" -U "$db_user" -p "$db_port" -d "$db_name" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null 2>&1 \
        || fail "Migration failed: $(basename "$migration")"
      migration_count=$((migration_count + 1))
    done
    shopt -u nullglob

    success "Migrations applied: ${migration_count}"

    # Check tables (optional - warn but don't fail)
    local table_count
    table_count="$(PGPASSWORD="$db_pass" psql -h "$db_host" -U "$db_user" -p "$db_port" -d "$db_name" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo 0)"
    if [[ "$table_count" -gt 0 ]]; then
      success "Tables present in public schema: ${table_count}"
    else
      warn "No tables found after migrations (this may be OK for v1 scope)"
    fi
  else
    info "No migrations directory found at ${migrations_dir}; skipping migration step (OK for v1)"
  fi
}

###############################################################################
# Step 6: Seed demo user (idempotent) + verify login
###############################################################################

_seed_demo_user() {
  local supabase_url="$1"
  local anon_key="$2"
  local service_role_key="$3"

  [[ -n "$service_role_key" ]] || fail "SUPABASE_SERVICE_ROLE_KEY is required for seeding demo user"

  info "Seeding demo user (idempotent)..."

  # Create user
  local create_res
  create_res="$(curl -sS -X POST "${supabase_url}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${service_role_key}" \
    -H "apikey: ${anon_key}" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"${DEMO_USER_EMAIL}\",\"password\":\"${DEMO_USER_PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"seeded\":true}}" \
    2>/dev/null || true)"

  # If user already exists, Supabase often returns an error; that's fine.
  if echo "$create_res" | jq -e '.id? // empty' >/dev/null 2>&1; then
    DEMO_USER_ID="$(echo "$create_res" | jq -r '.id')"
    success "Demo user created: ${DEMO_USER_EMAIL} (id=${DEMO_USER_ID})"
  else
    info "Create user response did not include id (likely already exists). Verifying existence..."
  fi

  # List users and locate by email
  local list_res
  list_res="$(curl -sS -X GET "${supabase_url}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${service_role_key}" \
    -H "apikey: ${anon_key}" \
    2>/dev/null || echo "[]")"

  # Some Supabase versions return {users:[...]}.
  local user_id
  user_id="$(echo "$list_res" | jq -r --arg email "$DEMO_USER_EMAIL" '
      if has("users") then (.users[]? | select(.email==$email) | .id)
      else (.[]? | select(.email==$email) | .id)
    ' 2>/dev/null | head -n 1)"

  [[ -n "$user_id" && "$user_id" != "null" ]] || fail "Demo user does not exist after seeding: ${DEMO_USER_EMAIL}"
  DEMO_USER_ID="$user_id"
  success "Demo user exists: ${DEMO_USER_EMAIL} (id=${DEMO_USER_ID})"
}

_login_demo_user() {
  local supabase_url="$1"
  local anon_key="$2"

  info "Logging in demo user..."

  local login_res
  login_res="$(curl -sS -X POST "${supabase_url}/auth/v1/token?grant_type=password" \
    -H "apikey: ${anon_key}" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"${DEMO_USER_EMAIL}\",\"password\":\"${DEMO_USER_PASSWORD}\"}" \
    2>/dev/null || true)"

  local token
  token="$(echo "$login_res" | jq -r '.access_token // null' 2>/dev/null || echo "null")"
  [[ -n "$token" && "$token" != "null" ]] || fail "No access token returned from auth service (check email/password)"

  # sanity check token length
  [[ ${#token} -gt 100 ]] || fail "Token appears too short to be valid"

  VERIFY_AUTH_TOKEN="$token"

  success "Login successful (token prefix: ${token:0:20}...)"
}

_verify_profile_access() {
  local supabase_url="$1"
  local anon_key="$2"
  local token="$3"

  info "Verifying profile access for logged-in user..."

  # /auth/v1/user returns the user tied to the access token
  local user_res
  user_res="$(curl -sS -X GET "${supabase_url}/auth/v1/user" \
    -H "Authorization: Bearer ${token}" \
    -H "apikey: ${anon_key}" \
    2>/dev/null || true)"

  local user_id
  user_id="$(echo "$user_res" | jq -r '.id // null' 2>/dev/null || echo "null")"

  [[ -n "$user_id" && "$user_id" != "null" ]] || fail "User profile not accessible via /auth/v1/user"

  VERIFY_USER_ID="$user_id"

  if [[ -n "$DEMO_USER_ID" ]]; then
    [[ "$VERIFY_USER_ID" == "$DEMO_USER_ID" ]] || fail "Logged in as wrong user (expected ${DEMO_USER_ID}, got ${VERIFY_USER_ID})"
  fi

  success "Profile route verified (user id: ${VERIFY_USER_ID})"
}

step_seed_and_login() {
  info "Step 6: Seeding demo user and verifying login..."

  local supabase_url="${VITE_SUPABASE_URL:-$SUPABASE_URL_DEFAULT}"
  local anon_key="${VITE_SUPABASE_ANON_KEY}"
  local service_role_key="${SUPABASE_SERVICE_ROLE_KEY:-}"  # required for seeding

  _seed_demo_user "$supabase_url" "$anon_key" "$service_role_key"
  _login_demo_user "$supabase_url" "$anon_key"
  _verify_profile_access "$supabase_url" "$anon_key" "$VERIFY_AUTH_TOKEN"

  success "Seed + login verified"
}

###############################################################################
# Step 7: Optional backend health check
###############################################################################

step_backend_check() {
  info "Step 7: Checking backend (optional)..."

  local backend_url="${BACKEND_URL:-http://localhost:3000/health}"

  if curl -fsS --connect-timeout 3 "$backend_url" >/dev/null 2>&1; then
    success "Backend is reachable: ${backend_url}"
  else
    warn "Backend not reachable at ${backend_url} (this may be OK if you only verify Supabase + SPA)"
  fi
}

###############################################################################
# Step 8: Final Definition of Done + write result file
###############################################################################

step_dod() {
  info "Step 8: Final Definition of Done check..."

  [[ -n "${VERIFY_AUTH_TOKEN:-}" ]] || fail "DOD FAIL: Auth token missing"
  [[ -n "${VERIFY_USER_ID:-}" ]] || fail "DOD FAIL: User ID missing"
  [[ -n "${DEMO_USER_ID:-}" ]] || fail "DOD FAIL: Demo user id missing"
  [[ "$VERIFY_USER_ID" == "$DEMO_USER_ID" ]] || fail "DOD FAIL: Wrong user (expected ${DEMO_USER_ID}, got ${VERIFY_USER_ID})"

  echo "{\"status\":\"ok\",\"user\":$(json_string "$DEMO_USER_EMAIL"),\"user_id\":$(json_string "$DEMO_USER_ID"),\"timestamp\":\"$(_ts)\"}" > "${RESULT_FILE}"
  success "Definition of Done satisfied"
}

###############################################################################
# Main
###############################################################################

main() {
  # Guarantee result file is written even on unexpected exits
  trap 'rc=$?; if [[ $rc -ne 0 ]]; then echo "{\"status\":\"failed\",\"error\":\"unexpected exit\",\"timestamp\":\"'"$(_ts)"'\"}" > "$RESULT_FILE"; fi' EXIT

  # Start with a clean result file
  echo "{\"status\":\"running\",\"timestamp\":\"$(_ts)\"}" > "${RESULT_FILE}"

  step_tools
  step_enforce_versions
  step_load_env
  step_verify_supabase_ready
  step_verify_postgres
  step_db_migrations
  step_seed_and_login
  step_backend_check
  step_dod

  echo "Result written to: ${RESULT_FILE}"
}

main "$@"
