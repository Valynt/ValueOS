#!/usr/bin/env bash
set -euo pipefail

# Deterministic Supabase interface contract validator.
# Verifies expected compose services and host endpoints rather than container implementation details.

COMPOSE_FILES_CSV="${DX_SUPABASE_COMPOSE_FILES:-ops/compose/compose.yml,ops/compose/profiles/supabase.yml}"
DB_SERVICE="${DX_SUPABASE_DB_SERVICE:-postgres}"
API_SERVICE="${DX_SUPABASE_API_SERVICE:-rest}"
AUTH_SERVICE="${DX_SUPABASE_AUTH_SERVICE:-auth}"
STUDIO_SERVICE="${DX_SUPABASE_STUDIO_SERVICE:-studio}"

SUPABASE_API_PORT="${SUPABASE_API_PORT:-${DX_SUPABASE_EXPECT_API_PORT:-54321}}"
AUTH_PORT="${AUTH_PORT:-${DX_SUPABASE_EXPECT_AUTH_PORT:-9999}}"
STUDIO_PORT="${STUDIO_PORT:-${DX_SUPABASE_EXPECT_STUDIO_PORT:-54324}}"

fail() { echo "FAIL: $*" >&2; exit 1; }
warn() { echo "WARN: $*" >&2; }
ok() { echo "OK: $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

need_cmd docker
need_cmd awk
need_cmd sed
need_cmd grep
need_cmd tail
need_cmd curl

compose_files=()
IFS=',' read -r -a raw_compose_files <<< "$COMPOSE_FILES_CSV"
for raw in "${raw_compose_files[@]}"; do
  file="$(echo "$raw" | sed 's/^ *//; s/ *$//')"
  [[ -n "$file" ]] || continue
  [[ -f "$file" ]] || fail "Compose file not found: $file (set DX_SUPABASE_COMPOSE_FILES to override)"
  compose_files+=("-f" "$file")
done
[[ ${#compose_files[@]} -gt 0 ]] || fail "No compose files configured via DX_SUPABASE_COMPOSE_FILES"

compose() {
  docker compose "${compose_files[@]}" "$@"
}

service_exists() {
  local service="$1"
  compose ps --all --services 2>/dev/null | grep -Fx "$service" >/dev/null 2>&1
}

service_running() {
  local service="$1"
  compose ps --services --status running 2>/dev/null | grep -Fx "$service" >/dev/null 2>&1
}

echo "Supabase Doctor"
echo "  compose files: ${COMPOSE_FILES_CSV}"
echo "  db service:    ${DB_SERVICE}"
echo "  api service:   ${API_SERVICE}"
echo "  auth service:  ${AUTH_SERVICE}"
echo "  studio service:${STUDIO_SERVICE}"
echo "  auth endpoint: http://localhost:${AUTH_PORT}"
echo "  api endpoint:  http://localhost:${SUPABASE_API_PORT}"
echo

for s in "$DB_SERVICE" "$API_SERVICE" "$AUTH_SERVICE"; do
  service_exists "$s" || fail "Service not found in compose files: $s"
  service_running "$s" || fail "Service not running: $s"
done

if service_exists "$STUDIO_SERVICE"; then
  service_running "$STUDIO_SERVICE" || warn "Studio service exists but is not running: $STUDIO_SERVICE"
else
  warn "Studio service not found in compose files: $STUDIO_SERVICE (continuing)"
fi

echo "Compose service status:"
compose ps "$DB_SERVICE" "$API_SERVICE" "$AUTH_SERVICE" "$STUDIO_SERVICE" 2>/dev/null || compose ps

echo

echo "DB readiness:"
compose exec -T "$DB_SERVICE" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select version(); select 1;" >/dev/null \
  && ok "DB responds to SQL" \
  || fail "DB did not respond to SQL"
echo

echo "Recent logs (last 10m, tail 200):"
for s in "$DB_SERVICE" "$AUTH_SERVICE" "$API_SERVICE"; do
  echo "---- $s ----"
  compose logs "$s" --since 10m 2>/dev/null | tail -n 200 || true
done
if service_exists "$STUDIO_SERVICE"; then
  echo "---- $STUDIO_SERVICE ----"
  compose logs "$STUDIO_SERVICE" --since 10m 2>/dev/null | tail -n 200 || true
fi
echo

probe_http() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || echo "000")"
  if [[ "$code" == "000" ]]; then
    fail "${label} not reachable (connection refused/timeout): ${url}"
  fi
  ok "${label} reachable (${code}): ${url}"
}

echo "HTTP probes:"
probe_http "Auth" "http://localhost:${AUTH_PORT}/health"
probe_http "Supabase API" "http://localhost:${SUPABASE_API_PORT}"

if service_exists "$STUDIO_SERVICE" && service_running "$STUDIO_SERVICE"; then
  probe_http "Studio" "http://localhost:${STUDIO_PORT}"
else
  warn "Skipping Studio probe; service not present/running."
fi

echo
ok "All deterministic checks passed."
