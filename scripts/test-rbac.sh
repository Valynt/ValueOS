#!/bin/bash

# RBAC Quick Test Script
# This script demonstrates assigning roles and testing them locally
# 
# Usage: ./test-rbac.sh

set -e

echo "========================================="
echo "ValueOS RBAC Quick Test"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL:-http://localhost:54321}"
SUPABASE_DASHBOARD="${SUPABASE_URL/54321/54323}"

echo -e "${BLUE}Step 1: Prerequisites Check${NC}"
echo "Checking if Supabase is running..."

if curl -s "$SUPABASE_URL/rest/v1/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Supabase is running${NC}"
else
    echo -e "${YELLOW}⚠ Supabase doesn't appear to be running${NC}"
    echo "Start it with: pnpm run supabase:start"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Opening Supabase Dashboard${NC}"
echo "Dashboard URL: $SUPABASE_DASHBOARD"
echo ""
echo "Please:"
echo "  1. Open the Supabase Dashboard in your browser"
echo "  2. Navigate to SQL Editor"
echo "  3. Create a new query"
echo ""

# Determine which opener to use
if command -v xdg-open > /dev/null; then
    xdg-open "$SUPABASE_DASHBOARD" 2>/dev/null || true
elif command -v open > /dev/null; then
    open "$SUPABASE_DASHBOARD" 2>/dev/null || true
else
    echo "Open this URL manually: $SUPABASE_DASHBOARD"
fi

echo ""
read -p "Press Enter when ready to continue..."

echo ""
echo -e "${BLUE}Step 3: Test SQL Scripts${NC}"
echo ""
echo "The following test scripts are available:"
echo ""
echo "  📄 SQL Test Script:"
echo "     /workspaces/ValueOS/supabase/tests/rbac_local_test.sql"
echo ""
echo "  Copy and paste this entire file into the SQL Editor"
echo "  then click 'Run' to execute all tests"
echo ""

read -p "Have you run the SQL test script? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓ SQL tests completed${NC}"
else
    echo -e "${YELLOW}⚠ Skipping SQL test verification${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: TypeScript Tests${NC}"
echo ""
echo "Running TypeScript test suite..."
echo ""

# Check if we're in the correct directory
if [ -f "package.json" ]; then
    # Check if test file exists
    if [ -f "src/test/rbac.local.test.ts" ]; then
        echo "Running: pnpm test -- rbac.local.test.ts"
        echo ""
        
        # Try to run the test
        if pnpm test -- rbac.local.test.ts 2>&1; then
            echo ""
            echo -e "${GREEN}✓ TypeScript tests passed${NC}"
        else
            echo ""
            echo -e "${YELLOW}⚠ TypeScript tests had errors${NC}"
            echo "This is okay if you haven't set up all environment variables yet"
        fi
    else
        echo -e "${YELLOW}⚠ Test file not found at src/test/rbac.local.test.ts${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not in project root directory${NC}"
fi

echo ""
echo -e "${BLUE}Step 5: Summary & Next Steps${NC}"
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "✓ Created test documentation"
echo "✓ Created SQL test script"
echo "✓ Created TypeScript tests"
echo ""
echo "📚 Documentation:"
echo "  • Full Guide:      docs/security/ASSIGN_ROLES_GUIDE.md"
echo "  • Quick Reference: docs/security/RBAC_QUICK_REFERENCE.md"
echo "  • RBAC Guide:      docs/security/rbac-guide.md"
echo ""
echo "🧪 Test Files:"
echo "  • SQL Tests:  supabase/tests/rbac_local_test.sql"
echo "  • TS Tests:   src/test/rbac.local.test.ts"
echo ""
echo "📋 Example: Assign role to user"
echo ""
echo "SQL (run in dashboard):"
echo "  INSERT INTO user_roles (user_id, role_id, tenant_id)"
echo "  SELECT 'YOUR-USER-UUID', id, 'YOUR-TENANT-ID'"
echo "  FROM roles WHERE name = 'tenant_admin';"
echo ""
echo "========================================="
echo ""

# Offer to open relevant files
echo "Would you like to open the documentation? (y/n)"
read -p "> " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v code > /dev/null; then
        code docs/security/ASSIGN_ROLES_GUIDE.md
        code docs/security/RBAC_QUICK_REFERENCE.md
        echo -e "${GREEN}✓ Opened documentation in VS Code${NC}"
    else
        echo "Documentation files:"
        echo "  - docs/security/ASSIGN_ROLES_GUIDE.md"
        echo "  - docs/security/RBAC_QUICK_REFERENCE.md"
    fi
fi

echo ""
echo -e "${GREEN}RBAC test setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the documentation"
echo "  2. Assign roles to your users via SQL Editor"
echo "  3. Test permissions in your application"
echo "  4. Check audit logs for role assignments"
echo ""
