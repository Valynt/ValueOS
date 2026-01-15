.PHONY: help clean verify seed test dev

help:
	@echo "ValueOS Development Commands"
	@echo ""
	@echo "  make verify    - Golden path smoke test (full system check)"
	@echo "  make clean     - Reset everything to zero state"
	@echo "  make seed      - Seed demo data (idempotent)"
	@echo "  make dev       - Start development server"
	@echo "  make test      - Run test suite"
	@echo ""

# Golden Path Smoke Test
# This is the failsafe - if this passes, the system works
verify:
	@echo "🔍 Running golden path verification..."
	@echo ""
	@echo "Step 1: Validate environment"
	@npm run env:validate || exit 1
	@echo ""
	@echo "Step 2: Reset database"
	@npm run dx:reset || exit 1
	@echo ""
	@echo "Step 3: Seed demo data"
	@npm run seed || exit 1
	@echo ""
	@echo "Step 4: Verify login"
	@tsx scripts/verify-login.ts || exit 1
	@echo ""
	@echo "Step 5: Run health check"
	@npm run health || exit 1
	@echo ""
	@echo "✅ All verification steps passed!"
	@echo "System is operational."

# Clean slate - start from zero
clean:
	@echo "🧹 Resetting to zero state..."
	npm run dx:clean
	rm -rf node_modules/.vite
	rm -rf dist
	@echo "✅ Clean complete"

# Idempotent seed
seed:
	@echo "🌱 Seeding demo data..."
	@tsx scripts/seed-demo-user.ts || exit 1

# Development server
dev:
	@echo "🚀 Starting development server..."
	npm run dev

# Test suite
test:
	@echo "🧪 Running tests..."
	npm run test || exit 1
