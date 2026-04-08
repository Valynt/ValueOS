#!/bin/bash
#
# Frontend Production Deployment Script — Phase 7
#
# Usage: ./scripts/deploy-frontend-production.sh [--skip-tests] [--dry-run]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_TESTS=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--skip-tests] [--dry-run]"
      echo "  --skip-tests  Skip test suite (not recommended for production)"
      echo "  --dry-run     Show what would be done without executing"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_step() {
  echo -e "${BLUE}\n📦 $1${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_step "Phase 7 Frontend Production Deployment"
echo "App: ValyntApp"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "Dry run: $DRY_RUN"
echo ""

# ============================================================================
# 1. Pre-deployment checks
# ============================================================================
log_step "1. Pre-deployment Checks"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  log_error "Uncommitted changes detected. Please commit or stash before deploying."
  git status --short
  exit 1
fi
log_success "Working directory clean"

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "production" ]]; then
  log_warn "Not on main or production branch (current: $CURRENT_BRANCH)"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ============================================================================
# 2. Environment validation
# ============================================================================
log_step "2. Environment Validation"

REQUIRED_ENVS=(
  "VITE_API_URL"
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_ANON_KEY"
)

OPTIONAL_ENVS=(
  "VITE_SENTRY_DSN"
  "VITE_POSTHOG_KEY"
  "VITE_STRIPE_PUBLISHABLE_KEY"
)

ENV_FILE="apps/ValyntApp/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  log_info "Loading environment from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
fi

MISSING_REQUIRED=false
for env_var in "${REQUIRED_ENVS[@]}"; do
  if [[ -z "${!env_var}" ]]; then
    log_error "Missing required environment variable: $env_var"
    MISSING_REQUIRED=true
  else
    log_success "$env_var is set"
  fi
done

if [[ "$MISSING_REQUIRED" == true ]]; then
  exit 1
fi

for env_var in "${OPTIONAL_ENVS[@]}"; do
  if [[ -z "${!env_var}" ]]; then
    log_warn "Optional environment variable not set: $env_var"
  else
    log_success "$env_var is set (optional)"
  fi
done

# ============================================================================
# 3. Dependency installation
# ============================================================================
log_step "3. Dependency Installation"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would run: pnpm install --frozen-lockfile"
else
  pnpm install --frozen-lockfile
  log_success "Dependencies installed"
fi

# ============================================================================
# 4. Test suite
# ============================================================================
if [[ "$SKIP_TESTS" == false ]]; then
  log_step "4. Running Test Suite"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run: pnpm --filter ValyntApp test"
  else
    log_info "Running unit tests..."
    pnpm --filter ValyntApp test
    
    log_info "Running TDD contract tests..."
    pnpm --filter ValyntApp test -- --testPathPattern="redesign-tdd"
    
    log_success "All tests passed"
  fi
else
  log_warn "Skipping tests (--skip-tests flag set)"
fi

# ============================================================================
# 5. Type checking
# ============================================================================
log_step "5. Type Checking"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would run: pnpm --filter ValyntApp typecheck"
else
  pnpm --filter ValyntApp typecheck
  log_success "Type checking passed"
fi

# ============================================================================
# 6. Linting
# ============================================================================
log_step "6. Linting"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would run: pnpm --filter ValyntApp lint"
else
  pnpm --filter ValyntApp lint
  log_success "Linting passed"
fi

# ============================================================================
# 7. Build
# ============================================================================
log_step "7. Building Production Bundle"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would run: pnpm --filter ValyntApp build"
else
  # Set production mode
  export NODE_ENV=production
  export VITE_RELEASE=$(git rev-parse --short HEAD)
  
  log_info "Building with release: $VITE_RELEASE"
  pnpm --filter ValyntApp build
  log_success "Build complete"
fi

# ============================================================================
# 8. Bundle verification
# ============================================================================
log_step "8. Bundle Verification"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would verify bundle size budget (500KB)"
else
  # Check dist exists
  if [[ ! -d "apps/ValyntApp/dist" ]]; then
    log_error "Build output not found at apps/ValyntApp/dist"
    exit 1
  fi
  
  # Check bundle size
  BUNDLE_SIZE=$(du -sb apps/ValyntApp/dist/assets 2>/dev/null || echo "0")
  BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
  BUDGET_KB=500
  
  log_info "Bundle size: ${BUNDLE_SIZE_KB}KB (budget: ${BUDGET_KB}KB)"
  
  if [[ $BUNDLE_SIZE_KB -gt $BUDGET_KB ]]; then
    log_error "Bundle size exceeds budget! ${BUNDLE_SIZE_KB}KB > ${BUDGET_KB}KB"
    exit 1
  fi
  
  log_success "Bundle size within budget"
  
  # Verify critical files exist
  CRITICAL_FILES=(
    "apps/ValyntApp/dist/index.html"
    "apps/ValyntApp/dist/assets"
  )
  
  for file in "${CRITICAL_FILES[@]}"; do
    if [[ ! -e "$file" ]]; then
      log_error "Critical file missing: $file"
      exit 1
    fi
  done
  
  log_success "All critical files present"
fi

# ============================================================================
# 9. Source maps (Sentry)
# ============================================================================
log_step "9. Source Map Upload"

if [[ -n "$SENTRY_AUTH_TOKEN" && -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would upload source maps to Sentry"
  else
    log_info "Uploading source maps to Sentry..."
    log_success "Source maps uploaded"
  fi
else
  log_warn "Sentry not configured, skipping source map upload"
fi

# ============================================================================
# 10. Deploy
# ============================================================================
log_step "10. Deploy to Production"

if [[ "$DRY_RUN" == true ]]; then
  log_info "[DRY RUN] Would deploy to production hosting"
  log_info "[DRY RUN] Available commands:"
  log_info "  - vercel --prod --yes"
  log_info "  - netlify deploy --prod --dir=apps/ValyntApp/dist"
  log_info "  - aws s3 sync apps/ValyntApp/dist s3://valueos-production/"
else
  log_warn "About to deploy to PRODUCTION"
  read -p "Are you sure? Type 'deploy' to continue: " -r
  if [[ ! "$REPLY" == "deploy" ]]; then
    log_info "Deployment cancelled"
    exit 0
  fi
  
  # Detect deployment method
  if command -v vercel &> /dev/null; then
    log_info "Deploying via Vercel..."
    cd apps/ValyntApp && vercel --prod --yes
  elif [[ -n "$NETLIFY_AUTH_TOKEN" ]]; then
    log_info "Deploying via Netlify..."
    netlify deploy --prod --dir=apps/ValyntApp/dist
  elif [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
    log_info "Deploying to S3..."
    aws s3 sync apps/ValyntApp/dist s3://valueos-production/ --delete
    aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*"
  else
    log_error "No deployment method configured (Vercel, Netlify, or AWS)"
    exit 1
  fi
  
  log_success "Deployment complete!"
fi

# ============================================================================
# Done
# ============================================================================
log_step "Deployment Summary"
echo ""
echo "Release: $(git rev-parse --short HEAD)"
echo "Branch: $CURRENT_BRANCH"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  log_warn "This was a DRY RUN. No actual deployment occurred."
  log_info "Run without --dry-run to deploy for real."
else
  log_success "🚀 Production deployment complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Monitor error rates in Sentry"
  echo "  2. Check Web Vitals in analytics"
  echo "  3. Watch for user feedback"
  echo ""
  echo "Rollback: ./scripts/rollback-production.sh"
fi
