# Tasks

## P0 — Launch Blocking

### 1. API Versioning Fix

- [ ] 1.1 Fix unreachable code in `packages/backend/src/versioning.ts` — three consecutive `return` statements before `next()`
- [ ] 1.2 Restructure so 426 response is returned when version is unsupported
- [ ] 1.3 Move `API-Deprecated-Versions` header to after version resolution
- [ ] 1.4 Ensure `next()` only called on happy path
- [ ] 1.5 Unit test: unsupported version → HTTP 426
- [ ] 1.6 Unit test: supported version → correct `API-Version` header
- [ ] 1.7 Unit test: deprecated versions → `API-Deprecated-Versions` header set

### 2. MFA Enforcement

- [ ] 2.1 Add startup assertion: `MFA_ENABLED !== "true"` in production → fail fast
- [ ] 2.2 Document in `.env.example` and go-live checklist

### 3. Security Documentation

- [ ] 3.1 Document CORS wildcard rejection in `.env.example` and go-live checklist
- [ ] 3.2 Document Docker Compose credential enforcement in `DEPLOY.md`
- [ ] 3.3 Verify frontend bundle service-role CI check runs on every PR

### 4. Remove Accidental Directories

- [ ] 4.1 Remove accidentally committed `c:/Users/` directory if present
- [ ] 4.2 Add to `.gitignore` to prevent recurrence

## P1 — High Priority

### 5. TypeScript Any Reduction

- [ ] 5.1 Measure current `any` count: backend, ValyntApp, sdui
- [ ] 5.2 Target: backend < 400, ValyntApp < 200, sdui < 150
- [ ] 5.3 Fix highest-impact `any` usages in backend services
- [ ] 5.4 Fix `any` usages in ValyntApp hooks and views
- [ ] 5.5 Update `ts-any-baseline.json` with new counts

### 6. Service Deduplication

- [ ] 6.1 Audit duplicate services: identify `ValueTreeService` duplicates
- [ ] 6.2 Delete root `services/ValueTreeService.ts` (keep domain-specific one)
- [ ] 6.3 Redirect all imports to canonical location
- [ ] 6.4 Verify no other duplicate services exist

### 7. Structured Logging

- [ ] 7.1 Replace all `console.log` in backend with structured `logger` calls
- [ ] 7.2 Enable ESLint `no-console` rule for backend
- [ ] 7.3 Verify no `console.log` in production backend code

### 8. Test Coverage Thresholds

- [ ] 8.1 Raise CI coverage thresholds: lines=75%, functions=70%, branches=70%
- [ ] 8.2 Update `vitest.config.ts` with new thresholds
- [ ] 8.3 Fix failing tests to meet new thresholds
- [ ] 8.4 Un-skip E2E test `TEST-E2E-CRITICAL-003` using `page.route()`

### 9. Legacy Code Removal

- [ ] 9.1 Remove legacy root directories: `client/`, `server/`, `shared/` if present
- [ ] 9.2 Add ESLint ban on imports from legacy paths
- [ ] 9.3 Verify no remaining references to legacy directories

### 10. Frontend Tenant Isolation Audit

- [ ] 10.1 Audit `getBenchmarks` and `getOntologyStats` for tenant isolation
- [ ] 10.2 Add unit tests verifying tenant_id is always included in queries
- [ ] 10.3 Fix any missing tenant filters

### 11. Worker HPA Documentation

- [ ] 11.1 Document worker HPA queue-depth scaling in deployment guide
- [ ] 11.2 Verify HPA configuration is correct for current workload

## P2 — Medium Priority

### 12. OpenAPI Spec Coverage

- [ ] 12.1 Audit all Express routes not covered by OpenAPI spec
- [ ] 12.2 Add OpenAPI definitions for agent endpoints
- [ ] 12.3 Add OpenAPI definitions for billing endpoints
- [ ] 12.4 Add OpenAPI definitions for onboarding endpoints
- [ ] 12.5 Add CI check that flags undocumented routes

### 13. SLO/SLI Documentation

- [ ] 13.1 Create `infra/observability/SLOs.md`
- [ ] 13.2 Define SLOs for: case creation latency (< 5s p95), agent execution latency (< 30s p95), API availability (99.9%), error rate (< 1%)
- [ ] 13.3 Define corresponding SLIs and measurement methods

### 14. DAST Gate

- [ ] 14.1 Add OWASP ZAP scan to CI pipeline
- [ ] 14.2 Fail pipeline on high-severity findings
- [ ] 14.3 Document DAST configuration and baseline

### 15. Release Waiver Tracking

- [ ] 15.1 Audit existing 13 release-critical test waivers
- [ ] 15.2 Fix R1-SKIP-002 (fixable without external dependencies)
- [ ] 15.3 Ensure all waivers have: owner, reason, expiry date, ticket reference
- [ ] 15.4 Add CI check: fail if waiver is expired without resolution

### 16. SSE Compliance Stream Fix

- [ ] 16.1 Fix `setInterval` in SSE compliance stream that is never cleared on client disconnect
- [ ] 16.2 Add cleanup handler for SSE connection close
- [ ] 16.3 Unit test cleanup behavior
