#!/usr/bin/env bash
set -euo pipefail

############################################
# Supabase Cloud Project Bootstrap Script
############################################

# REQUIRED: Supabase project ref (from dashboard URL)
# Example: abcdefghijklmnop
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_ID:-}"

# OPTIONAL: database password (recommended via env)
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

# Optional: region sanity check
SUPABASE_REGION_EXPECTED="${SUPABASE_REGION_EXPECTED:-}"

############################################
# Guards
############################################

if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
  echo "❌ SUPABASE_PROJECT_REF is not set"
  echo "   Export it or set it in your .env file"
  exit 1
fi

############################################
# Check Supabase login status
############################################

echo "🔐 Checking Supabase authentication…"
if ! supabase projects list &>/dev/null; then
  echo "❌ Not logged in to Supabase CLI"
  echo "   Please run: supabase login"
  echo "   Or set SUPABASE_ACCESS_TOKEN environment variable"
  exit 1
fi

echo "✅ Supabase CLI authenticated"

############################################
# Link project
############################################

echo "🔗 Linking Supabase Cloud project: $SUPABASE_PROJECT_REF"

# Run from project root, specify workdir for config
supabase link \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --workdir infra/supabase \
  ${SUPABASE_DB_PASSWORD:+--password "$SUPABASE_DB_PASSWORD"}

############################################
# Verify link
############################################

echo "🔍 Verifying linked project…"
supabase status || true

############################################
# Optional: pull remote config (safe)
############################################

echo "⬇️  Pulling remote config (no secrets)…"
supabase config pull --overwrite || true

############################################
# Optional: sanity checks
############################################

if [[ -n "$SUPABASE_REGION_EXPECTED" ]]; then
  REGION=$(supabase projects list | grep "$SUPABASE_PROJECT_REF" | awk '{print $3}')
  if [[ "$REGION" != "$SUPABASE_REGION_EXPECTED" ]]; then
    echo "⚠️  Region mismatch: expected $SUPABASE_REGION_EXPECTED, got $REGION"
  fi
fi

############################################
# Success
############################################

echo "✅ Supabase Cloud project ready"
echo "   Project ref: $SUPABASE_PROJECT_REF"
