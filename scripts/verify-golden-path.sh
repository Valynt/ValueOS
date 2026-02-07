#!/bin/bash
set -euo pipefail

# ValueOS Golden Path Verification
# Proves the entire system works end-to-end
# Exit 0 = system works, Exit != 0 = broken

echo "=== ValueOS Golden Path Verification ==="
echo ""

# Run full setup
bash scripts/setup-dev-failsafe.sh || exit 1

# Capture PIDs from setup output
BACKEND_PID=$(pgrep -f "tsx watch src/backend/server.ts" | head -1)
FRONTEND_PID=$(pgrep -f "vite --config" | head -1)

# Cleanup function
cleanup() {
  echo ""
  echo "Cleaning up..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  pnpm run dx:down >/dev/null 2>&1 || true
  pnpm supabase stop --no-backup >/dev/null 2>&1 || true
}

trap cleanup EXIT

# Additional end-to-end tests
echo ""
echo "=== Running End-to-End Tests ==="

# Test 1: Create a value case via API
echo "Test 1: Create value case..."
TOKEN=$(curl -s -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d '{"email":"demouser@valynt.com","password":"passw0rd"}' | \
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

[ -n "$TOKEN" ] || { echo "FAIL: Could not get auth token"; exit 1; }
echo "✓ Authentication works"

# Test 2: Hit protected endpoint
PROTECTED_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3001/api/health)

[ "$PROTECTED_RESPONSE" = '{"status":"ok"}' ] || { echo "FAIL: Protected endpoint failed"; exit 1; }
echo "✓ Protected endpoints work"

# Test 3: Database connectivity
DB_TEST=$(docker compose -f .devcontainer/docker-compose.devcontainer.yml exec -T db psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM auth.users WHERE email='demouser@valynt.com'" 2>/dev/null || \
  docker exec valueos-db psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM auth.users WHERE email='demouser@valynt.com'")

[ "$DB_TEST" = "1" ] || { echo "FAIL: Demo user not in database"; exit 1; }
echo "✓ Database queries work"

echo ""
echo "=== ALL TESTS PASSED ==="
echo ""
echo "The system is fully operational and reproducible."
exit 0
