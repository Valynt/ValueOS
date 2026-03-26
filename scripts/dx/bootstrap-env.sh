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
API_PORT=8000
VITE_PORT=5173
EOF
    echo "[bootstrap-env] Created .env.ports with defaults."
  fi
else
  echo "[bootstrap-env] .env.ports already exists."
fi

# local (developer-specific)
echo "[bootstrap-env] Checking ops/env/.env.local..."
if [[ ! -f ops/env/.env.local ]]; then
  if [[ -f ops/env/.env.local.example ]]; then
    cp ops/env/.env.local.example ops/env/.env.local
    echo "[bootstrap-env] Created ops/env/.env.local from template."
  elif [[ -f .env.local.example ]]; then
    cp .env.local.example ops/env/.env.local
    echo "[bootstrap-env] Created ops/env/.env.local from root template."
  else
    cat > ops/env/.env.local <<'EOF'
# Developer-local overrides (NOT committed)
TOGETHER_API_KEY=
SUPABASE_ANON_KEY=
VITE_SUPABASE_ANON_KEY=
EOF
    echo "[bootstrap-env] Created ops/env/.env.local with defaults."
  fi
else
  echo "[bootstrap-env] ops/env/.env.local already exists."
fi

# backend (developer-specific secrets/config)
echo "[bootstrap-env] Checking ops/env/.env.backend.local..."
if [[ ! -f ops/env/.env.backend.local ]]; then
  if [[ -f ops/env/.env.backend.local.example ]]; then
    cp ops/env/.env.backend.local.example ops/env/.env.backend.local
    echo "[bootstrap-env] Created ops/env/.env.backend.local from template."
  else
    cat > ops/env/.env.backend.local <<'EOF'
APP_ENV=local
NODE_ENV=development
API_PORT=3001
BACKEND_PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
EOF
    echo "[bootstrap-env] Created ops/env/.env.backend.local with defaults."
  fi
else
  echo "[bootstrap-env] ops/env/.env.backend.local already exists."
fi

# Ensure every developer has a unique TCT_SECRET in backend env.
if ! grep -Eq '^TCT_SECRET=' ops/env/.env.backend.local; then
  TCT_SECRET_VALUE="$(openssl rand -hex 32)"
  printf '\nTCT_SECRET=%s\n' "$TCT_SECRET_VALUE" >> ops/env/.env.backend.local
  echo "[bootstrap-env] Added generated TCT_SECRET to ops/env/.env.backend.local."
elif grep -Eq '^TCT_SECRET=\s*$' ops/env/.env.backend.local; then
  TCT_SECRET_VALUE="$(openssl rand -hex 32)"
  sed -i "s/^TCT_SECRET=.*/TCT_SECRET=${TCT_SECRET_VALUE}/" ops/env/.env.backend.local
  echo "[bootstrap-env] Replaced empty TCT_SECRET in ops/env/.env.backend.local."
fi

echo "[bootstrap-env] Done."
