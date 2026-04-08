#!/bin/bash
#
# Emergency Rollback Script — Phase 7
#
# Usage: ./scripts/rollback-frontend-production.sh [VERSION]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_emergency() { echo -e "${RED}🚨 $1${NC}"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
log_emergency "EMERGENCY ROLLBACK INITIATED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""

# Check for required environment
if [[ -z "$ROLLBACK_TOKEN" ]]; then
  log_error "ROLLBACK_TOKEN not set. This is a safety measure."
  log_info "Set ROLLBACK_TOKEN to confirm intentional rollback:"
  log_info "  export ROLLBACK_TOKEN=I_UNDERSTAND_THIS_WILL_ROLLBACK_PRODUCTION"
  exit 1
fi

# Get previous version (git)
PREVIOUS_VERSION=$(git rev-parse --short HEAD~1)
TARGET_VERSION="${1:-$PREVIOUS_VERSION}"

echo "Target version: $TARGET_VERSION"
echo "Current version: $(git rev-parse --short HEAD)"
echo ""

# ============================================================================
# Step 1: Immediate Safety Measures
# ============================================================================
log_emergency "STEP 1: Immediate Safety Measures"

# Disable feature flags immediately (if API available)
if [[ -n "$ADMIN_API_KEY" && -n "$ADMIN_API_URL" ]]; then
  log_info "Disabling feature flags via admin API..."
  curl -s -X POST "$ADMIN_API_URL/admin/feature-flags" \
    -H "Authorization: Bearer $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"ENABLE_NEW_WORKSPACE": false}' || true
  log_success "Feature flags disabled"
else
  log_warn "Admin API not configured. Manual feature flag disable required."
fi

# ============================================================================
# Step 2: Rollback Deployment
# ============================================================================
log_emergency "STEP 2: Rollback Deployment"

log_info "Checking out previous version: $TARGET_VERSION"
git checkout "$TARGET_VERSION" || {
  log_error "Failed to checkout version $TARGET_VERSION"
  exit 1
}

# Rebuild
log_info "Rebuilding..."
pnpm install --frozen-lockfile
pnpm --filter ValyntApp build

# Redeploy
if command -v vercel &> /dev/null; then
  log_info "Redeploying via Vercel..."
  cd apps/ValyntApp && vercel --prod --yes
elif [[ -n "$NETLIFY_AUTH_TOKEN" ]]; then
  log_info "Redeploying via Netlify..."
  netlify deploy --prod --dir=apps/ValyntApp/dist
elif [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
  log_info "Redeploying to S3..."
  aws s3 sync apps/ValyntApp/dist s3://valueos-production/ --delete
  aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*"
else
  log_error "No deployment method configured"
  exit 1
fi

log_success "Rollback deployment complete"

# ============================================================================
# Step 3: Verification
# ============================================================================
log_emergency "STEP 3: Verification"

log_info "Waiting for deployment to propagate..."
sleep 10

DEPLOY_URL="${VITE_API_URL%/api}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  log_success "Health check passed (HTTP 200)"
else
  log_warn "Health check returned HTTP $HTTP_STATUS"
  log_warn "Manual verification required"
fi

# ============================================================================
# Step 4: Notifications
# ============================================================================
log_emergency "STEP 4: Notifications"

if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
  log_info "Notifying Slack..."
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚨 PRODUCTION ROLLBACK EXECUTED\nVersion: $TARGET_VERSION\nTime: $(date -u +"%Y-%m-%d %H:%M:%S UTC")\nBy: $(whoami)\"}" || true
fi

# ============================================================================
# Done
# ============================================================================
echo ""
log_emergency "ROLLBACK COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_warn "Actions required:"
echo "  1. Verify application functionality"
echo "  2. Check error rates in Sentry"
echo "  3. Investigate cause of rollback"
echo "  4. Notify team in #incidents"
echo "  5. Schedule post-mortem"
echo ""
log_info "To redeploy after fix:"
echo "  ./scripts/deploy-frontend-production.sh"
echo ""
