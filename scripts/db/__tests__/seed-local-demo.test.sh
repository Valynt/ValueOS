#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SEED="$ROOT/scripts/db/seed-local-demo.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cat > "$work/psql" <<'PSQL'
#!/usr/bin/env bash
touch "$SEED_TEST_PSQL_MARKER"
PSQL
chmod +x "$work/psql"
export PATH="$work:$PATH"
export SEED_TEST_PSQL_MARKER="$work/psql-called"

local_url='postgresql://postgres:example@127.0.0.1:54322/postgres'
user_id='00000000-0000-4000-8000-000000000001'

clean_env() {
  env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGDATABASE -u PGUSER -u PGOPTIONS "$@"
}
expect_rejected() {
  rm -f "$SEED_TEST_PSQL_MARKER"
  if clean_env "$@" bash "$SEED" >"$work/output.log" 2>&1; then
    echo "FAIL: local seed accepted an unsafe invocation" >&2
    exit 1
  fi
  if [[ -e "$SEED_TEST_PSQL_MARKER" ]]; then
    echo "FAIL: local seed invoked psql after rejecting unsafe invocation" >&2
    exit 1
  fi
}

expect_rejected ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url"
expect_rejected APP_ENV=production ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url"
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=false DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url"
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL='postgresql://postgres:example@remote.example.com:54322/postgres'
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url?host=remote.example.com"
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url?hostaddr=203.0.113.10"
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url#remote"
expect_rejected APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID='invalid-uuid' DATABASE_URL="$local_url"
expect_rejected PGHOSTADDR=203.0.113.10 APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url"
expect_rejected PGSERVICE=remote APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url"

rm -f "$SEED_TEST_PSQL_MARKER"
clean_env APP_ENV=local ALLOW_LOCAL_DEMO_SEED=true DEMO_AUTH_USER_ID="$user_id" DATABASE_URL="$local_url" bash "$SEED" >"$work/output.log" 2>&1
if [[ ! -e "$SEED_TEST_PSQL_MARKER" ]]; then
  echo "FAIL: safe local invocation did not reach psql" >&2
  exit 1
fi
echo "PASS: demo seeding requires opt-in and cannot redirect libpq remotely"
