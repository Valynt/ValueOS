# Engineering: Production Readiness & DX

## 1. Unified Configuration Management
ValueOS uses a "fail-fast" configuration strategy.
- **Schema**: Zod-validated schema in `src/config/schema.ts`.
- **Runtime**: Config is injected into `window.__CONFIG__` at deploy time.
- **Validation**: `pnpm run config:validate` checks all environments for missing or invalid keys.

## 2. Database Migration Safety
To prevent data loss and security regressions:
- **Rollback Testing**: Every migration must pass automated rollback verification in CI.
- **RLS Verification**: Automated tests ensure 90%+ RLS policy coverage.
- **Performance**: Migrations are analyzed for potentially slow operations (e.g., adding indexes to large tables).

## 3. Caddy Edge Proxy
Caddy serves as our production-ready entry point.
- **Features**: Automatic HTTPS (Let's Encrypt), rate limiting, and security headers.
- **Multi-Tenancy**: Supports wildcard subdomains and custom domain management.
- **Deployment**: Kubernetes-native with zero-downtime reloads.

## 4. Developer Experience (DX)
- **Orchestration**: `pnpm run dx` automates the local stack.
- **Anti-Fragility**: Ghost Mode (MSW) and Dev HUD for resilient development.
- **Diagnostics**: `pnpm run dx:doctor` for environment health checks.

---
**Last Updated:** 2026-01-28
**Related:** `docs/engineering/ENGINEERING_MASTER.md`, `docs/dev/DEV_MASTER.md`
