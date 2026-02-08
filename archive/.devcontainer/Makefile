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
	@pnpm run env:validate || exit 1
	@echo ""
	@echo "Step 2: Reset database"
	@pnpm run dx:reset || exit 1
	@echo ""
	@echo "Step 3: Seed demo data"
	@pnpm run seed || exit 1
	@echo ""
	@echo "Step 4: Verify login"
	@tsx scripts/verify-login.ts || exit 1
	@echo ""
	@echo "Step 5: Run health check"
	@pnpm run health || exit 1
	@echo ""
	@echo "✅ All verification steps passed!"
	@echo "System is operational."

# Clean slate - start from zero
clean:
	@echo "🧹 Resetting to zero state..."
	pnpm run dx:clean
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
	pnpm run dev

# Test suite
test:
	@echo "🧪 Running tests..."
	pnpm run test || exit 1

# Install Playwright browsers and OS deps (idempotent)
install-playwright:
	@echo "Installing Playwright browsers and OS deps..."
	@bash .devcontainer/scripts/install-playwright-deps.sh || true

# Build a devcontainer image with Playwright OS deps (for headed mode)
build-playwright-image:
	@echo "Building devcontainer image with Playwright OS deps (may take several minutes)"
	docker build -f .devcontainer/Dockerfile.dev --build-arg INSTALL_PLAYWRIGHT_DEPS=1 -t valueos-dev:playwright . || true
