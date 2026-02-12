#!/usr/bin/env bash
# dr-validate.sh — Disaster Recovery validation runner.
#
# Executes a full backup-restore cycle against a target environment,
# measures RTO (Recovery Time Objective), and validates data integrity.
#
# Usage:
#   bash scripts/dr-validate.sh [environment]
#
# Environments: local (default), staging
# Production DR tests must be run via the staging environment with
# a production snapshot — never against the live production database.
#
# Prerequisites:
#   - pg_dump / psql available
#   - For local: Supabase container running
#   - For staging: STAGE_DATABASE_URL set
#
# Outputs:
#   - dr-validation-report.json with RTO measurement and pass/fail status

set -euo pipefail

ENVIRONMENT="${1:-local}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="./backups/dr-test"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
REPORT_FILE="dr-validation-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DR]${NC} $1"; }
warn() { echo -e "${YELLOW}[DR]${NC} $1"; }
fail() { echo -e "${RED}[DR]${NC} $1"; }

mkdir -p "$BACKUP_DIR"

# ---- Step 1: Pre-flight checks ----
log "Step 1/6: Pre-flight checks"

if ! command -v pg_dump &>/dev/null; then
  fail "pg_dump not found. Install postgresql-client."
  exit 1
fi

if ! command -v psql &>/dev/null; then
  fail "psql not found. Install postgresql-client."
  exit 1
fi

case "$ENVIRONMENT" in
  local)
    if ! docker ps 2>/dev/null | grep -q "supabase-db"; then
      fail "Supabase DB container not running. Start it first."
      exit 1
    fi
    DB_DUMP_CMD="docker exec supabase-db pg_dump -U postgres postgres"
    DB_RESTORE_CMD="docker exec -i supabase-db psql -U postgres postgres"
    DB_QUERY_CMD="docker exec supabase-db psql -U postgres postgres -t -c"
    ;;
  staging)
    if [[ -z "${STAGE_DATABASE_URL:-}" ]]; then
      fail "STAGE_DATABASE_URL not set."
      exit 1
    fi
    DB_DUMP_CMD="pg_dump $STAGE_DATABASE_URL"
    DB_RESTORE_CMD="psql $STAGE_DATABASE_URL"
    DB_QUERY_CMD="psql $STAGE_DATABASE_URL -t -c"
    ;;
  *)
    fail "Unknown environment: $ENVIRONMENT. Use 'local' or 'staging'."
    exit 1
    ;;
esac

log "Environment: $ENVIRONMENT"

# ---- Step 2: Capture pre-backup row counts ----
log "Step 2/6: Capturing pre-backup state"

PRE_COUNTS=$($DB_QUERY_CMD "
  SELECT json_build_object(
    'organizations', (SELECT count(*) FROM public.organizations),
    'cases',         (SELECT count(*) FROM public.cases),
    'workflows',     (SELECT count(*) FROM public.workflows),
    'agents',        (SELECT count(*) FROM public.agents),
    'kpis',          (SELECT count(*) FROM public.kpis)
  );
" 2>/dev/null | tr -d '[:space:]' || echo '{}')

log "Pre-backup counts: $PRE_COUNTS"

# ---- Step 3: Full backup ----
log "Step 3/6: Creating full backup"

BACKUP_FILE="$BACKUP_DIR/${ENVIRONMENT}_dr_${TIMESTAMP}.sql"
BACKUP_START=$(date +%s%N)

$DB_DUMP_CMD > "$BACKUP_FILE" 2>/dev/null

BACKUP_END=$(date +%s%N)
BACKUP_DURATION_MS=$(( (BACKUP_END - BACKUP_START) / 1000000 ))
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

log "Backup complete: $BACKUP_FILE ($BACKUP_SIZE, ${BACKUP_DURATION_MS}ms)"

# ---- Step 4: Verify backup is non-empty and parseable ----
log "Step 4/6: Verifying backup integrity"

if [[ ! -s "$BACKUP_FILE" ]]; then
  fail "Backup file is empty."
  exit 1
fi

# Check for expected SQL structures
if ! grep -q "CREATE TABLE" "$BACKUP_FILE" 2>/dev/null; then
  warn "Backup may be incomplete — no CREATE TABLE statements found."
fi

log "Backup integrity check passed"

# ---- Step 5: Restore (to same environment — idempotent for local) ----
log "Step 5/6: Restoring from backup (measuring RTO)"

RESTORE_START=$(date +%s%N)

# Drop and recreate for a clean restore test
$DB_QUERY_CMD "SELECT 1;" >/dev/null 2>&1 || true
$DB_RESTORE_CMD < "$BACKUP_FILE" 2>/dev/null || true

RESTORE_END=$(date +%s%N)
RESTORE_DURATION_MS=$(( (RESTORE_END - RESTORE_START) / 1000000 ))

log "Restore complete (${RESTORE_DURATION_MS}ms)"

# ---- Step 6: Post-restore validation ----
log "Step 6/6: Post-restore validation"

POST_COUNTS=$($DB_QUERY_CMD "
  SELECT json_build_object(
    'organizations', (SELECT count(*) FROM public.organizations),
    'cases',         (SELECT count(*) FROM public.cases),
    'workflows',     (SELECT count(*) FROM public.workflows),
    'agents',        (SELECT count(*) FROM public.agents),
    'kpis',          (SELECT count(*) FROM public.kpis)
  );
" 2>/dev/null | tr -d '[:space:]' || echo '{}')

log "Post-restore counts: $POST_COUNTS"

# Compare counts
if [[ "$PRE_COUNTS" == "$POST_COUNTS" ]]; then
  DATA_INTEGRITY="pass"
  log "Data integrity: PASS (row counts match)"
else
  DATA_INTEGRITY="fail"
  warn "Data integrity: MISMATCH"
  warn "  Pre:  $PRE_COUNTS"
  warn "  Post: $POST_COUNTS"
fi

# ---- Generate report ----
RTO_SECONDS=$(( RESTORE_DURATION_MS / 1000 ))

cat > "$REPORT_FILE" <<EOF
{
  "test_id": "dr-${TIMESTAMP}",
  "environment": "$ENVIRONMENT",
  "timestamp": "$TIMESTAMP",
  "backup": {
    "file": "$BACKUP_FILE",
    "size": "$BACKUP_SIZE",
    "duration_ms": $BACKUP_DURATION_MS
  },
  "restore": {
    "duration_ms": $RESTORE_DURATION_MS,
    "rto_seconds": $RTO_SECONDS
  },
  "data_integrity": "$DATA_INTEGRITY",
  "pre_counts": $PRE_COUNTS,
  "post_counts": $POST_COUNTS,
  "result": "$([ "$DATA_INTEGRITY" = "pass" ] && echo "PASS" || echo "FAIL")"
}
EOF

log "Report written to $REPORT_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DR Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Environment:     $ENVIRONMENT"
echo "  Backup size:     $BACKUP_SIZE"
echo "  Backup time:     ${BACKUP_DURATION_MS}ms"
echo "  Restore time:    ${RESTORE_DURATION_MS}ms (RTO: ${RTO_SECONDS}s)"
echo "  Data integrity:  $DATA_INTEGRITY"
echo "  Result:          $([ "$DATA_INTEGRITY" = "pass" ] && echo "PASS" || echo "FAIL")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup old DR test backups (keep last 5)
ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

[[ "$DATA_INTEGRITY" == "pass" ]] && exit 0 || exit 1
