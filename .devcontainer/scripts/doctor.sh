#!/usr/bin/env bash
set -euo pipefail

ROOT="${WORKSPACE_FOLDER:-$(pwd)}"
cd "$ROOT"

ok() { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }

printf '== ValueOS Devcontainer Doctor ==\n'

ok "OS: $(uname -srm)"
ok "Arch: $(uname -m)"

if command -v node >/dev/null 2>&1; then
  ok "Node: $(node -v)"
else
  warn "Node not found"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm: $(pnpm -v)"
else
  warn "pnpm not found"
fi

if [[ -S /var/run/docker.sock ]]; then
  ok "Docker mode: host socket (/var/run/docker.sock)"
elif pgrep -x dockerd >/dev/null 2>&1; then
  ok "Docker mode: DinD (dockerd process detected)"
else
  warn "Docker mode not detected"
fi

for host in github.com registry.npmjs.org supabase.com; do
  if getent hosts "$host" >/dev/null 2>&1; then
    ok "DNS: resolved $host"
  else
    warn "DNS: failed to resolve $host"
  fi
done

required_env=(POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_DB)
for key in "${required_env[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    ok "Env present: $key"
  else
    warn "Env missing: $key"
  fi
done

for endpoint in https://api.supabase.com https://auth.supabase.com; do
  if curl -sS -I --max-time 5 "$endpoint" >/dev/null 2>&1; then
    ok "Reachable: $endpoint"
  else
    warn "Unreachable: $endpoint"
  fi
done

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | tail -n +2 | grep -q .
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  return 2
}

for port in 3001 5173 54323 54324 8000 8001; do
  if port_in_use "$port"; then
    warn "Port in use: $port"
  else
    status=$?
    if [[ $status -eq 2 ]]; then
      warn "Port check skipped for $port (missing ss/lsof)"
    else
      ok "Port available: $port"
    fi
  fi
done
