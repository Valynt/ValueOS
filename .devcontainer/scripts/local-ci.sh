#!/bin/bash
# Local CI Simulation Script
# Runs a lightweight version of the CI pipeline locally before pushing

set -e  # Exit on error

echo "🚀 Running local CI simulation..."
echo ""

# Colors for output
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Dependency Analysis
echo "📊 Step 1: Analyzing dependencies..."
npm run analyze:deps

if [ -f "impact.json" ]; then
  RISK_SCORE=$(cat impact.json | jq -r '.risk Score')
  AFFECTED_FILES=$(cat impact.json | jq -r '.affectedFiles | length')
  
  echo -e "${YELLOW}   Risk Score: $RISK_SCORE/10${NC}"
  echo -e "${YELLOW}   Affected Files: $AFFECTED_FILES${NC}"
  echo ""
fi

# Step 2: Type Checking
echo "🔍 Step 2: Type checking..."
npm run typecheck
echo -e "${GREEN}   ✓ Type check passed${NC}"
echo ""

# Step 3: Linting
echo "🧹 Step 3: Linting code..."
npm run lint
echo -e "${GREEN}   ✓ Lint passed${NC}"
echo ""

# Step 4: Smart Test Selection
echo "🧪 Step 4: Running affected tests..."
if [ -f "impact.json" ]; then
  AFFECTED_TESTS=$(cat impact.json | jq -r '.affectedTests[]' 2>/dev/null || echo "")
  
  if [ -z "$AFFECTED_TESTS" ]; then
    echo -e "${YELLOW}   No affected tests found. Running all tests...${NC}"
    npm test
  else
    echo -e "${GREEN}   Running $(cat impact.json | jq '.affectedTests | length') affected tests${NC}"
    npm test -- $(echo "$AFFECTED_TESTS" | tr '\n' ' ')
  fi
else
  echo -e "${YELLOW}   Impact analysis not found. Running all tests...${NC}"
  npm test
fi
echo ""

# Step 5: Build Check
echo "🏗️  Step 5: Build verification..."
npm run build
echo -e "${GREEN}   ✓ Build successful${NC}"
echo ""

# Step 6: Security Scan (Quick)
echo "🔒 Step 6: Quick security scan..."
npm audit --audit-level=high || echo -e "${YELLOW}   ⚠️  Security vulnerabilities found (non-blocking)${NC}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Local CI simulation passed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Summary:"
if [ -f "impact.json" ]; then
  echo "   • Blast Radius: $(cat impact.json | jq -r '.blastRadius') files"
  echo "   • Risk Score: $(cat impact.json | jq -r '.riskScore')/10"
  echo "   • Affected Services: $(cat impact.json | jq -r '.affectedServices | join(", ")')"
fi
echo "   • Type check: ✓"
echo "   • Lint: ✓"
echo "   • Tests: ✓"
echo "   • Build: ✓"
echo ""
echo "🚀 Safe to push to remote!"
echo ""
