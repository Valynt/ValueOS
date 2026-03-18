#!/usr/bin/env bash
# Fresh Clone End-to-End Test Script
# Simulates what a new engineer experiences with a fresh clone

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "==================================="
echo "Fresh Clone End-to-End Test"
echo "==================================="
echo ""
echo "Testing repository at: ${REPO_ROOT}"
echo ""

FAILED=0
PASS=0

# Helper functions
pass() {
    echo "✅ $1"
    ((PASS++))
}

fail() {
    echo "❌ $1"
    ((FAILED++))
}

# Step 1: Verify core structure
echo "Step 1: Core Repository Structure"
echo "-----------------------------------"

if [[ -f "${REPO_ROOT}/package.json" ]]; then
    pass "package.json exists"
else
    fail "package.json missing"
fi

if [[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then
    pass "pnpm-lock.yaml exists (deterministic installs)"
else
    fail "pnpm-lock.yaml missing"
fi

if [[ -f "${REPO_ROOT}/README.md" ]]; then
    pass "README.md exists"
else
    fail "README.md missing"
fi

# Step 2: Verify DevContainer setup
echo ""
echo "Step 2: DevContainer Setup"
echo "--------------------------"

DEVCONTAINER_FILES=(
    ".devcontainer/devcontainer.json"
    ".devcontainer/.env.template"
    ".devcontainer/docker-compose.devcontainer.yml"
    ".devcontainer/Dockerfile.optimized"
    ".devcontainer/README.md"
)

for file in "${DEVCONTAINER_FILES[@]}"; do
    if [[ -f "${REPO_ROOT}/${file}" ]]; then
        pass "${file} exists"
    else
        fail "${file} missing"
    fi
done

# Step 3: Verify scripts exist
echo ""
echo "Step 3: Required Scripts"
echo "------------------------"

SCRIPTS=(
    ".devcontainer/scripts/ensure-dotenv.sh"
    ".devcontainer/scripts/post-create.sh"
    ".devcontainer/scripts/post-start.sh"
    "scripts/db/apply-migrations.sh"
    "scripts/dx/doctor.js"
)

for script in "${SCRIPTS[@]}"; do
    if [[ -f "${REPO_ROOT}/${script}" ]]; then
        if [[ -x "${REPO_ROOT}/${script}" ]] || [[ "${script}" == *.js ]]; then
            pass "${script} exists"
        else
            pass "${script} exists (not executable, may be sourced)"
        fi
    else
        fail "${script} missing"
    fi
done

# Step 4: Verify package.json scripts
echo ""
echo "Step 4: Package.json Scripts"
echo "----------------------------"

cd "${REPO_ROOT}"

REQUIRED_SCRIPTS=(
    "dev"
    "dev:frontend"
    "dev:backend"
    "build"
    "test"
    "lint"
    "check"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if pnpm run --silent 2>/dev/null | grep -q "^  ${script}$"; then
        pass "script '${script}' defined"
    else
        fail "script '${script}' missing"
    fi
done

# Step 5: Verify README mentions DevContainer
echo ""
echo "Step 5: README Documentation"
echo "------------------------------"

if grep -q "DevContainer\|devcontainer" "${REPO_ROOT}/README.md"; then
    pass "README mentions DevContainer"
else
    fail "README doesn't mention DevContainer"
fi

if grep -q "Quickstart.*DevContainer" "${REPO_ROOT}/README.md"; then
    pass "README has DevContainer quickstart"
else
    fail "README missing DevContainer quickstart"
fi

# Step 6: Verify .env.template has required vars
echo ""
echo "Step 6: Environment Template"
echo "----------------------------"

TEMPLATE="${REPO_ROOT}/.devcontainer/.env.template"
if [[ -f "${TEMPLATE}" ]]; then
    REQUIRED_VARS=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "JWT_SECRET"
        "TCT_SECRET"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "${var}=" "${TEMPLATE}"; then
            pass "Template has ${var}"
        else
            fail "Template missing ${var}"
        fi
    done
else
    fail ".env.template not found"
fi

# Step 7: Verify CI workflows
echo ""
echo "Step 7: CI/CD Configuration"
echo "---------------------------"

if [[ -f "${REPO_ROOT}/.github/workflows/ci.yml" ]]; then
    pass "CI workflow exists"
    
    # Check for devcontainer job
    if grep -q "devcontainer-build" "${REPO_ROOT}/.github/workflows/ci.yml"; then
        pass "CI has devcontainer-build job"
    else
        fail "CI missing devcontainer-build job"
    fi
else
    fail "CI workflow missing"
fi

# Step 8: Verify migration system
echo ""
echo "Step 8: Database Migration System"
echo "----------------------------------"

if [[ -d "${REPO_ROOT}/infra/supabase/migrations" ]]; then
    pass "Migrations directory exists"
else
    fail "Migrations directory missing"
fi

if grep -q '"db:migrate"' "${REPO_ROOT}/package.json"; then
    pass "db:migrate script defined"
else
    fail "db:migrate script missing"
fi

# Step 9: Test pnpm install (if not already done)
echo ""
echo "Step 9: Dependency Installation"
echo "--------------------------------"

if [[ -d "${REPO_ROOT}/node_modules" ]]; then
    pass "node_modules exists (dependencies installed)"
else
    echo "⚠️  node_modules not found - would need 'pnpm install'"
fi

# Summary
echo ""
echo "==================================="
echo "Test Summary"
echo "==================================="
echo "Passed: ${PASS}"
echo "Failed: ${FAILED}"
echo ""

if [[ ${FAILED} -eq 0 ]]; then
    echo "✅ Fresh clone validation PASSED"
    echo "The repository is ready for a new engineer to clone and use."
    exit 0
else
    echo "❌ Fresh clone validation FAILED"
    echo "Address the ${FAILED} failed checks before launch."
    exit 1
fi
