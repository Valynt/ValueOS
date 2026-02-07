#!/usr/bin/env bash
set -euo pipefail

# Deterministic Supabase local health check that does NOT rely on `supabase status`.
# Works even when container names are customized (e.g., valueos-db, valueos-kong, ...).

PREFIX="${DX_SUPABASE_PREFIX:-valueos}"
DB_CTN="${DX_SUPABASE_DB_CONTAINER:-${PREFIX}-db}"
KONG_CTN="${DX_SUPABASE_KONG_CONTAINER:-${PREFIX}-kong}"
AUTH_CTN="${DX_SUPABASE_AUTH_CONTAINER:-${PREFIX}-auth}"
STUDIO_CTN="${DX_SUPABASE_STUDIO_CONTAINER:-${PREFIX}-studio}"

# Optional: expected host ports (if you want strict enforcement)
EXPECT_API_PORT="${DX_SUPABASE_EXPECT_API_PORT:-54321}"
EXPECT_STUDIO_PORT="${DX_SUPABASE_EXPECT_STUDIO_PORT:-54323}"

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

echo "Supabase Doctor"
echo "  prefix: ${PREFIX}"
echo "  db:     ${DB_CTN}"
echo "  kong:   ${KONG_CTN}"
echo "  auth:   ${AUTH_CTN}"
echo "  studio: ${STUDIO_CTN}"
echo

# Basic container existence
for c in "$DB_CTN" "$KONG_CTN" "$AUTH_CTN"; do
  docker inspect "$c" >/dev/null 2>&1 || fail "Container not found: $c"
done

# Optional: studio might not exist in some setups; treat as non-fatal
if ! docker inspect "$STUDIO_CTN" >/dev/null 2>&1; then
  warn "Studio container not found: $STUDIO_CTN (continuing)"
fi

# Status + health summary
echo "Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "^(NAMES|${PREFIX}-)" || true
echo

# DB readiness (runs inside db container, no host psql required)
echo "DB readiness:"
docker exec -i "$DB_CTN" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select version(); select 1;" >/dev/null \
  && ok "DB responds to SQL" \
  || fail "DB did not respond to SQL"
echo

# Recent logs (tail for fast signal)
echo "Recent logs (last 10m, tail 200):"
for c in "$DB_CTN" "$AUTH_CTN" "$KONG_CTN"; do
  echo "---- $c ----"
  docker logs "$c" --since 10m | tail -n 200 || true
done
if docker inspect "$STUDIO_CTN" >/dev/null 2>&1; then
  echo "---- $STUDIO_CTN ----"
  docker logs "$STUDIO_CTN" --since 10m | tail -n 200 || true
fi
echo

# Discover published host ports (if any) and probe them.
discover_host_port() {
  local ctn="$1"
  local internal_port="$2"  # e.g. "8000/tcp"
  docker port "$ctn" "$internal_port" 2>/dev/null | head -n 1 | awk -F: '{print $2}' | tr -d '[:space:]'
}

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

# Kong / API: by default, Supabase API is served via Kong.
echo "HTTP probes:"

# If you want strict enforcement of specific ports from config.toml:
probe_http "Kong/API" "http://localhost:${EXPECT_API_PORT}" || exit 1

if docker inspect "$STUDIO_CTN" >/dev/null 2>&1; then
  probe_http "Studio" "http://localhost:${EXPECT_STUDIO_PORT}" || exit 1
else
  warn "Skipping Studio probe; container not present."
fi

echo
ok "All deterministic checks passed."

