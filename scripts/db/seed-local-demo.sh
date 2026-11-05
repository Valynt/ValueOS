#!/usr/bin/env bash
# Explicit opt-in seed for an EXISTING local Supabase Auth user.
# Never run this script against a remote or production database.
set -euo pipefail

if [[ "${APP_ENV:-local}" != "local" || "${ALLOW_LOCAL_DEMO_SEED:-false}" != "true" ]]; then
  echo "Refusing seed: require APP_ENV=local and ALLOW_LOCAL_DEMO_SEED=true" >&2
  exit 2
fi

: "${DATABASE_URL:?DATABASE_URL must target local Supabase PostgreSQL}"
: "${DEMO_AUTH_USER_ID:?DEMO_AUTH_USER_ID is the UUID of a locally created Auth user}"

if [[ ! "$DEMO_AUTH_USER_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]]; then
  echo "Refusing seed: DEMO_AUTH_USER_ID is not a UUID" >&2
  exit 2
fi

host="$(node -e '
  try {
    const url = new URL(process.argv[1]);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) process.exit(1);
    process.stdout.write(url.hostname);
  } catch { process.exit(1); }
' "$DATABASE_URL")" || {
  echo "Refusing seed: invalid PostgreSQL database URL" >&2
  exit 2
}

case "$host" in
  localhost|127.0.0.1|"[::1]") ;;
  *) echo "Refusing seed: database hostname is not local" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v "demo_auth_user_id=$DEMO_AUTH_USER_ID" \
  -f "$SCRIPT_DIR/local-demo-tenant.sql"
echo "Local demo tenant seeded (no default credentials created)."
