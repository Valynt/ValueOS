# ValueOS Production Readiness Report

**Generated:** 2026-02-27  
**Status:** CONDITIONAL GO — critical blockers identified below

---

## 1. BLOCKERS (Must Fix Before Ship)

### 🔴 P0 — Immediate Blockers

#### 1.1 Massive TypeScript Error Baseline
- **Backend:** `tsErrorBaseline: 2897` (`packages/backend/package.json`)
- **Frontend:** `tsErrorBaseline: 4240` (`apps/ValyntApp/package.json`)
- **`any` count:** 1,977 across the monorepo (`ts-any-baseline.json`)
- **Impact:** Runtime type errors in production, unpredictable behavior
- **Fix:** The `tsc --noEmit` baseline is 3 errors (`.quality/tsc-baseline.json`), which is acceptable. The `tsErrorBaseline` fields appear to be per-package tracking. **Prioritize fixing backend errors** (2,897) since that's the production runtime. Frontend can ship with warnings since Vite build succeeds independently.
- **Quick win:** Run `pnpm --filter @valueos/backend build:typecheck` to see actual blocking errors vs warnings.

#### 1.2 Backend Has No Real Build Step
```json
"build": "echo 'Backend runs via tsx at runtime; no compile step needed'"
```
- **Impact:** Production runs TypeScript via `tsx` (JIT compilation), not pre-compiled JS. This means:
  - Slower cold starts
  - `dist/server.js` referenced in `"start"` script doesn't exist
  - Docker CMD uses `pnpm --filter @valueos/backend dev` — **dev mode in production container**
- **Fix (CRITICAL):** Add a real build step and fix the Dockerfile CMD for production:
  ```
  "build": "tsc --project tsconfig.json",
  "start": "node dist/server.js"
  ```
  Update `Dockerfile.backend` line 82:
  ```
  CMD ["node", "packages/backend/dist/server.js"]
  ```

#### 1.3 `docker-compose.prod.yml` Is Deprecated Shim
- `infra/docker/docker-compose.prod.yml` just includes `ops/compose/compose.yml` which is the **development** compose file
- `DEPLOY.md` references `docker-compose.prod.yml` for production deploys — **this deploys dev config to prod**
- **Fix:** Create a dedicated production compose file or use the K8s path exclusively. Update `DEPLOY.md` accordingly.

#### 1.4 No Production Environment Template File
- `ops/env/` only contains `README.md` — no `.env.production.template` or `.env.prod` example
- `DEPLOY.md` references `ops/env/.env.production.template` which **doesn't exist**
- **Fix:** Create `ops/env/.env.production.template` with all required production variables.

### 🟠 P1 — High Priority

#### 1.5 K8s Base Uses Placeholder Image References
- `infra/k8s/base/kustomization.yaml` has `REGISTRY_URL/valynt-backend:latest`
- Overlays must override this, but `latest` tag in base is a drift risk
- **Fix:** Ensure overlays pin to digest-based image refs (deploy.yml already does this via `docker/metadata-action`).

#### 1.6 Readiness Probe Depends on External API (Together.ai)
- `/health/ready` endpoint checks Together.ai API availability
- If Together.ai has an outage, your pods will be marked "not ready" and **all traffic stops**
- **Fix:** Move LLM provider checks to `/health/dependencies` only. Readiness should check DB + Redis only.

#### 1.7 PORT Mismatch Between Compose and K8s
- Docker Compose: backend on port `8000`
- Dockerfile HEALTHCHECK: checks `localhost:3001`
- K8s deployment: container port `8000`
- **Fix:** Align the Dockerfile HEALTHCHECK to port 8000 or make it configurable via `$PORT`.

---

## 2. CI/CD Pipeline Assessment

### ✅ Strengths (Already Production-Grade)
- **Comprehensive CI** (`ci.yml` — 799 lines): lint, typecheck, unit tests, integration tests, RLS compliance, SAST (Semgrep), SCA (Trivy), CodeQL, Hadolint, SBOM generation, IaC scanning
- **Deploy pipeline** (`deploy.yml`): quality gate → build → cosign verify → staging → SLO guard → production (blue-green)
- **Emergency bypass** with audit trail, incident ticket requirement, and deferred validation follow-up issues
- **Supply chain security:** cosign image signing/verification, SBOM (CycloneDX)
- **Blue-green deployments** with automatic rollback on failure
- **Coverage trend tracking** with baseline comparison on PRs
- **Compliance evidence** with signed checksums (cosign keyless)

### ⚠️ Gaps to Address
| Gap | Priority | Fix |
|-----|----------|-----|
| No smoke test for API endpoints beyond `/health` | P1 | Add critical API path checks post-deploy |
| No database migration step in deploy pipeline | P0 | Add `supabase db push` before deploy-staging |
| `check:browser-provider-secrets` script not in package.json | P1 | Add missing script or remove CI step |
| Integration tests may need Supabase secrets to pass | P1 | Ensure CI secrets are configured in GitHub |
| No canary/progressive rollout | P2 | Consider for post-launch |

---

## 3. Security Assessment

### ✅ Strong Security Posture
- **ESLint security plugin** with comprehensive rules (no-eval, detect-timing-attacks, etc.)
- **Helmet** middleware on backend
- **CSP reporting** endpoint configured
- **Rate limiting** (express-rate-limit + Redis-backed)
- **CSRF protection** middleware
- **Tenant isolation** enforced at ESLint, middleware, and DB (RLS) levels
- **Secret validation** at startup (production only) with graceful degradation
- **Secret volume watcher** for rotation without restart
- **Non-root container** users in both Dockerfiles
- **Read-only root filesystem** in K8s
- **Network policies** defined
- **seccomp + capabilities drop** in pod security context
- **Gitleaks** configured (`.gitleaks.toml`)
- **Dependabot** configured

### ⚠️ Security Gaps
| Gap | Priority | Fix |
|-----|----------|-----|
| `Dockerfile.frontend` has hardcoded default Supabase anon key | P1 | Remove default ARG value, require at build time |
| `SUPABASE_SERVICE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` naming inconsistency (K8s vs env) | P1 | Standardize to one name |
| Express 4.x — consider Express 5.x for security patches | P2 | Evaluate upgrade post-launch |
| `yamljs@0.3.0` is unmaintained — potential prototype pollution | P1 | Replace with `js-yaml` |
| No WAF/CDN layer mentioned | P2 | Add Cloudflare/AWS WAF before launch |

---

## 4. Testing Coverage Assessment

### ✅ What Exists
- **Vitest** with coverage thresholds (70% global, 80% for backend/frontend critical paths)
- **Integration test suite** in CI
- **RLS tenant isolation tests**
- **DSR compliance tests**
- **Audit log immutability tests**
- **Accessibility tests** (axe-core + Playwright)
- **Load tests** (k6, run against staging post-deploy)
- **Security agent tests** (`scripts/test-agent-security.sh`)
- **Playwright E2E** configured

### ⚠️ Testing Gaps
| Gap | Priority | Fix |
|-----|----------|-----|
| `passWithNoTests: true` in root vitest config | P1 | Set to `false` for critical projects (already done in projects config) |
| No billing flow integration test in CI | P1 | Wire up `infra/testing/test-billing-flow.sh` |
| No auth flow E2E test in deploy pipeline | P1 | Add post-deploy auth smoke test |
| Worker process (`workerMain.ts`) untested in CI | P2 | Add worker health check test |
| `@auth0/auth0-react` in frontend but Supabase Auth in backend — dual auth? | P0 | Clarify auth strategy, remove unused provider |

---

## 5. Performance & Scalability

### ✅ Already Production-Ready
- **HPA** (Horizontal Pod Autoscaler) configured
- **PDB** (Pod Disruption Budget) for backend and frontend
- **Pod anti-affinity** to spread across nodes
- **Redis** with `allkeys-lru` eviction, 512MB cap
- **Connection pooling** (PG_POOL_MIN=4, PG_POOL_MAX=40)
- **Rate limiting** (Redis-backed for distributed)
- **Agent cost limits** per session ($5 dev, $10 staging, $25 prod)
- **Circuit breaker** pattern in agent fabric
- **Prometheus metrics** endpoint with custom latency tracking
- **Grafana dashboards** defined

### ⚠️ Scalability Concerns
| Concern | Priority | Fix |
|---------|----------|-----|
| Backend runs via `tsx` (no pre-compilation) — slower cold starts | P0 | Add real TypeScript build step (see 1.2) |
| No CDN for static frontend assets | P1 | Put Cloudflare/CloudFront in front of nginx |
| WebSocket connections not horizontally scalable (no Redis adapter for socket.io) | P2 | Add `@socket.io/redis-adapter` if multi-pod WS needed |
| Kafka listed as optional but `kafkajs` in root deps | P2 | Remove if not used, or document as required |
| No database read replicas mentioned | P2 | Plan for post-launch if read-heavy |

---

## 6. Integrations Status

| Integration | Status | Notes |
|------------|--------|-------|
| **Supabase** (Auth + DB + Realtime) | ✅ Configured | RLS policies tested, migrations exist |
| **Redis** | ✅ Configured | Rate limiting, caching, session store |
| **Stripe** (Billing) | ⚠️ Partially | Router exists, `stripe-products-setup.sh` exists, but no billing integration test in CI |
| **Together.ai** (LLM) | ✅ Configured | Health check, fallback enabled |
| **OpenAI** | ✅ Optional | Graceful degradation if not configured |
| **Sentry** (Error tracking) | ✅ Configured | `@sentry/react` + `@sentry/vite-plugin` |
| **OpenTelemetry** (Observability) | ✅ Configured | Conditional loading, won't break if disabled |
| **Prometheus** (Metrics) | ✅ Configured | Custom metrics, SLO rules defined |
| **Winston + CloudWatch** (Logging) | ✅ Configured | Structured JSON logging |
| **Cosign** (Supply chain) | ✅ Configured | Image signing in deploy pipeline |
| **Auth0** | ❓ Unclear | `@auth0/auth0-react` in frontend but backend uses Supabase Auth |

---

## 7. Deployment Documentation

### ✅ What Exists
- `DEPLOY.md` — comprehensive with TLS requirements, Docker deploy, Supabase setup, minimal deploy path
- `ops/env/README.md` — environment mode documentation
- `infra/k8s/` — full Kustomize base + overlays (staging/production)
- `infra/environments/` — Terraform for dev/staging/prod

### ⚠️ Documentation Gaps
| Gap | Priority | Fix |
|-----|----------|-----|
| `DEPLOY.md` references non-existent `ops/env/.env.production.template` | P0 | Create the file |
| No runbook for common production incidents | P1 | Create `docs/runbooks/` |
| No database migration rollback procedure documented | P1 | Add to DEPLOY.md |
| Worker deployment not documented (separate process) | P1 | Add worker deploy section |
| K8s secret provisioning not documented | P1 | Document ExternalSecrets or manual secret creation |

---

## 8. Go/No-Go Checklist

### 🔴 NO-GO (Must Fix)
- [ ] **Backend build step** — Add real `tsc` build, fix Dockerfile CMD
- [ ] **Production compose/deploy path** — Fix deprecated shim or commit to K8s-only
- [ ] **Create `ops/env/.env.production.template`** — Referenced but missing
- [ ] **Database migration in deploy pipeline** — No migration step before deploy
- [ ] **Clarify Auth0 vs Supabase Auth** — Dual auth providers is a production risk
- [ ] **Fix readiness probe** — Remove Together.ai from readiness check
- [ ] **Fix Dockerfile HEALTHCHECK port** — 3001 vs 8000 mismatch

### 🟡 SHOULD FIX (Ship with known risk)
- [ ] TypeScript error baseline (2,897 backend / 4,240 frontend)
- [ ] Remove hardcoded Supabase key default from Dockerfile.frontend
- [ ] Replace `yamljs` with `js-yaml`
- [ ] Add billing flow integration test
- [ ] Add post-deploy auth smoke test
- [ ] Standardize `SUPABASE_SERVICE_KEY` naming
- [ ] CDN for static assets
- [ ] Production incident runbooks

### ✅ READY (No action needed)
- [x] CI/CD pipeline (comprehensive, automated)
- [x] Security scanning (SAST, SCA, CodeQL, IaC)
- [x] Blue-green deployment with rollback
- [x] Supply chain verification (cosign)
- [x] Health checks (liveness, readiness, startup, dependencies)
- [x] Rate limiting and CSRF protection
- [x] Tenant isolation (RLS + middleware + ESLint guards)
- [x] Observability (Prometheus, OTel, structured logging)
- [x] Secret management (validation, rotation, volume watcher)
- [x] HPA, PDB, pod anti-affinity
- [x] Graceful shutdown handlers
- [x] Compliance evidence (signed, retained 90 days)

---

## 9. Prioritized Action Items (Fastest Path to Production)

### Day 1 — Critical Fixes (4-6 hours)
1. **Add backend build step** and fix Dockerfile CMD
2. **Create `ops/env/.env.production.template`**
3. **Fix Dockerfile HEALTHCHECK port** alignment
4. **Fix readiness probe** — remove LLM provider from `/health/ready`
5. **Add migration step** to deploy pipeline (before staging deploy)

### Day 2 — High Priority (4-6 hours)
6. **Clarify auth strategy** (Auth0 vs Supabase) — remove unused
7. **Create production compose file** or document K8s-only deploy path
8. **Remove hardcoded Supabase key** from Dockerfile.frontend
9. **Replace `yamljs`** with maintained alternative
10. **Add billing + auth smoke tests** to deploy pipeline

### Day 3 — Polish (2-4 hours)
11. **Create incident runbooks**
12. **Document worker deployment**
13. **Document K8s secret provisioning**
14. **CDN setup** for frontend static assets
15. **Standardize env var naming** across K8s and compose

---

## Summary

The codebase has **excellent infrastructure foundations** — CI/CD, security scanning, compliance, observability, and deployment automation are all mature. The main blockers are:

1. **Backend doesn't have a real build step** (runs tsx in production)
2. **Missing production config files** referenced in docs
3. **Port/probe misalignment** in Docker/K8s
4. **No DB migration in deploy pipeline**
5. **Dual auth provider confusion**

Fixing the Day 1 items (~4-6 hours of work) would make this shippable to staging. Day 2 items would clear it for production. The architecture is sound — these are configuration and operational gaps, not fundamental design problems.
