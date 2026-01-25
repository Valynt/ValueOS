#!/usr/bin/env bash
set -euo pipefail

DIST_DIR=${1:-dist}

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Frontend build directory missing: $DIST_DIR"
  exit 1
fi

echo "🔍 Scanning frontend bundle for server-only secrets..."

if rg -n "SUPABASE_SERVICE_ROLE_KEY" "$DIST_DIR"; then
  echo "❌ Found SUPABASE_SERVICE_ROLE_KEY in frontend bundle"
  exit 1
fi

if rg -n "SUPABASE_SERVICE_KEY" "$DIST_DIR"; then
  echo "❌ Found SUPABASE_SERVICE_KEY in frontend bundle"
  exit 1
fi

secret_prefixes=(
  "whsec_"
  "sk_live_"
  "sk_test_"
  "rk_live_"
  "rk_test_"
)

for prefix in "${secret_prefixes[@]}"; do
  if rg -n "$prefix" "$DIST_DIR"; then
    echo "❌ Found secret-like key prefix ($prefix) in frontend bundle"
    exit 1
  fi
done

server_env_names=(
  "STRIPE_WEBHOOK_SECRET"
  "ALERT_WEBHOOK_URL"
  "SLACK_WEBHOOK_URL"
)

for name in "${server_env_names[@]}"; do
  if rg -n "$name" "$DIST_DIR"; then
    echo "❌ Found server env name ($name) in frontend bundle"
    exit 1
  fi
done

echo "✅ Frontend bundle secret scan passed"
