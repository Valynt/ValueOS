#!/bin/bash

# SSO/SAML Cleanup Script
# Removes test infrastructure for unimplemented SSO/SAML features

set -e

echo "🧹 Cleaning up SSO/SAML test infrastructure..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

echo "Files to be removed:"
echo "-------------------"

# List files that will be removed
FILES_TO_REMOVE=(
    "tests/test/saml/"
    "tests/test/playwright/saml-compliance.spec.ts"
    "tests/test/playwright/saml-slo.spec.ts"
    "infra/docker/compose.saml-test.yml"
    "infra/docker/docker-compose.saml-test.yml"
    ".github/workflows/saml-tests.yml"
    "docs/deployment/saml-test-implementation.md"
    "docs/archive/SAML_TEST_IMPLEMENTATION.md"
)

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -e "$file" ]; then
        echo "  - $file"
    fi
done

echo ""
read -p "Continue with removal? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "Removing files..."

# Remove SAML test directory
if [ -d "tests/test/saml/" ]; then
    rm -rf tests/test/saml/
    echo "✅ Removed tests/test/saml/"
fi

# Remove SAML test specs
if [ -f "tests/test/playwright/saml-compliance.spec.ts" ]; then
    rm -f tests/test/playwright/saml-compliance.spec.ts
    echo "✅ Removed saml-compliance.spec.ts"
fi

if [ -f "tests/test/playwright/saml-slo.spec.ts" ]; then
    rm -f tests/test/playwright/saml-slo.spec.ts
    echo "✅ Removed saml-slo.spec.ts"
fi

# Remove SAML Docker configs
if [ -f "infra/docker/compose.saml-test.yml" ]; then
    rm -f infra/docker/compose.saml-test.yml
    echo "✅ Removed compose.saml-test.yml"
fi

if [ -f "infra/docker/docker-compose.saml-test.yml" ]; then
    rm -f infra/docker/docker-compose.saml-test.yml
    echo "✅ Removed docker-compose.saml-test.yml"
fi

# Remove SAML GitHub workflow
if [ -f ".github/workflows/saml-tests.yml" ]; then
    rm -f .github/workflows/saml-tests.yml
    echo "✅ Removed saml-tests.yml workflow"
fi

# Remove SAML documentation
if [ -f "docs/deployment/saml-test-implementation.md" ]; then
    rm -f docs/deployment/saml-test-implementation.md
    echo "✅ Removed saml-test-implementation.md"
fi

if [ -f "docs/archive/SAML_TEST_IMPLEMENTATION.md" ]; then
    rm -f docs/archive/SAML_TEST_IMPLEMENTATION.md
    echo "✅ Removed SAML_TEST_IMPLEMENTATION.md"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit changes: git add -A && git commit -m 'chore: remove SSO/SAML test infrastructure'"
echo "3. Verify login still works: pnpm run dev"
echo ""
echo "Note: SSOConfig type kept in settingsMatrix.ts (marked as not implemented)"
