#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"

# ports
echo "[bootstrap-env] Checking .env.ports..."
if [[ ! -f .env.ports ]]; then
  if [[ -f ops/env/.env.ports.example ]]; then
    cp ops/env/.env.ports.example .env.ports
    echo "[bootstrap-env] Created .env.ports from template."
  elif [[ -f .env.ports.example ]]; then
    cp .env.ports.example .env.ports
    echo "[bootstrap-env] Created .env.ports from root template."
  else
    cat > .env.ports <<'EOF'
POSTGRES_PORT=54322
SUPABASE_API_PORT=54321
SUPABASE_STUDIO_PORT=54323
REDIS_PORT=6379
API_PORT=3001
VITE_PORT=5173
EOF
    echo "[bootstrap-env] Created .env.ports with defaults."
  fi
else
  echo "[bootstrap-env] .env.ports already exists."
fi

# local (developer-specific)
echo "[bootstrap-env] Checking .env.local..."
if [[ ! -f .env.local ]]; then
  if [[ -f ops/env/.env.local.example ]]; then
    cp ops/env/.env.local.example .env.local
    echo "[bootstrap-env] Created .env.local from template."
  elif [[ -f .env.local.example ]]; then
    cp .env.local.example .env.local
    echo "[bootstrap-env] Created .env.local from root template."
  else
    cat > .env.local <<'EOF'
# Developer-local overrides (NOT committed)
TOGETHER_API_KEY=
SUPABASE_ANON_KEY=
VITE_SUPABASE_ANON_KEY=
EOF
    echo "[bootstrap-env] Created .env.local with defaults."
  fi
else
  echo "[bootstrap-env] .env.local already exists."
fi

echo "[bootstrap-env] Done."
