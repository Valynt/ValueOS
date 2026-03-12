# Go-Live Security Checklist

**Audit date**: 2026-02-28
**Auditor**: Security Reviewer (automated)
**Scope**: Full codebase static audit — secrets, tenant isolation, auth, infra, CI/CD

---

## Critical Findings (MUST FIX before go-live)

### 1. Hardcoded dev bypass credentials in SignupPage (CRITICAL)

| Detail | Value |
|---|---|
| **File** | `apps/ValyntApp/src/pages/auth/SignupPage.tsx:62-64` |
| **Risk** | Hardcoded `email: "dev@valynt.com"`, `password: "bypass"`, `fullName: "Dev User"` shipped in source |
| **Impact** | If the bypass button renders in production, anyone can create a session with known credentials |
| **Mitigation** | Remove the hardcoded values. Gate the entire `handleBypass` function and its UI button behind `import.meta.env.DEV` or strip via Vite define. The `LoginPage.tsx` version correctly reads from `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD` env vars — align `SignupPage` to the same pattern, or better, remove bypass entirely from production builds. |

### 2. Auth bypass buttons ship in production bundle (CRITICAL)

| Detail | Value |
|---|---|
| **Files** | `apps/ValyntApp/src/pages/auth/LoginPage.tsx:211-213`, `apps/ValyntApp/src/pages/auth/SignupPage.tsx:212-214` |
| **Risk** | Both login and signup pages render a yellow "bypass" button unconditionally — no `import.meta.env.DEV` guard wraps the JSX |
| **Impact** | End-users see a dev-only authentication bypass in production UI |
| **Mitigation** | Wrap both the `handleBypass` function and the `<button onClick={handleBypass}>` JSX in `{import.meta.env.DEV && (...)}` so Vite tree-shakes them from production builds. Add a CI lint rule to prevent `handleBypass` from appearing in production bundles. |

### 3. MFA hardcoded to `false` (HIGH)

| Detail | Value |
|---|---|
| **File** | `packages/backend/src/config/environment.ts:30` |
| **Risk** | `auth: { mfaEnabled: false }` is a static default with no env-var override |
| **Impact** | MFA is unconditionally disabled for all environments including production |
| **Mitigation** | Change to `mfaEnabled: process.env.MFA_ENABLED === 'true'` and set `MFA_ENABLED=true` in production environment. |

### 4. CORS wildcard default in config (HIGH)

| Detail | Value |
|---|---|
| **File** | `packages/backend/src/config/environment.ts:68` |
| **Risk** | `corsOrigins: process.env.CORS_ORIGINS \|\| "*"` defaults to wildcard |
| **Impact** | If `CORS_ORIGINS` is unset, the server falls back to `*`. The runtime guard in `server.ts:300-301` throws on `*` with credentials — but only if the main server entry is used. Other entry points (WebSocket server at `packages/mcp/ground-truth/services/WebSocketServer.ts:72`) also default to `*`. |
| **Mitigation** | Remove the `*` fallback; make `CORS_ORIGINS` a required env var (use `?:` syntax like Supabase keys). Audit all CORS configurations across services. |

---

## High Findings

### 5. Frontend tenant isolation gaps in ValueFabricService (HIGH)

| Detail | Value |
|---|---|
| **Files** | `apps/ValyntApp/src/services/ValueFabricService.ts:276`, `:554-557` |
| **Risk** | `getBenchmarks()` and `getOntologyStats()` query tables without `tenant_id` or `organization_id` filter |
| **Impact** | Relies entirely on RLS. If RLS policies have gaps or `service_role` is accidentally used, cross-tenant data leaks are possible |
| **Mitigation** | Add explicit `.eq("organization_id", this.getOrganizationId())` to all queries, matching the pattern in the backend's `ValueFabricService.ts:76,167,274`. Defense-in-depth: never rely solely on RLS. |

### 6. `service_role` client in browser-bundleable code (HIGH)

| Detail | Value |
|---|---|
| **File** | `apps/ValyntApp/src/services/UsageTrackingService.ts:297-306` |
| **Risk** | `require("../lib/supabase").createServerSupabaseClient()` is called at module scope with a `try/catch` fallback — but the `require` path can be resolved by bundlers, potentially leaking `SUPABASE_SERVICE_ROLE_KEY` into the client bundle |
| **Impact** | If Vite resolves the import, the service-role key appears in browser-accessible JavaScript |
| **Mitigation** | Move `serviceRoleSupabase` to a server-only module that is never imported from frontend code. Use Vite's `ssr` or `server` directory conventions. Add a CI check (already have `pnpm check:browser-provider-secrets` — verify it catches this path). |

### 7. Postgres default credentials in Docker Compose (HIGH)

| Detail | Value |
|---|---|
| **File** | `ops/compose/compose.yml:31,74-76` |
| **Risk** | `PGUSER` defaults to `postgres`, `PGPASSWORD` uses `?:` (required) but `DATABASE_URL` line at `:31` has inline fallback `postgresql://postgres:postgres@postgres:5432/valueos` |
| **Impact** | If `DATABASE_URL` env is unset, the backend connects with `postgres:postgres` credentials |
| **Mitigation** | Remove the inline fallback from `DATABASE_URL`. Make it required: `DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL}`. |

### 8. Postgres port exposed to host (MEDIUM-HIGH)

| Detail | Value |
|---|---|
| **File** | `ops/compose/compose.yml:78-79` |
| **Risk** | `ports: - "${PGPORT:-5432}:5432"` exposes the database on the host network |
| **Impact** | In production-like environments, the database is accessible outside the Docker network |
| **Mitigation** | Bind to localhost only in non-production: `127.0.0.1:${PGPORT:-5432}:5432`. In production, remove the port mapping entirely or use Docker network-only access. |

---

## Medium Findings

### 9. Dev routes guard relies on dual check but is opt-in (MEDIUM)

| Detail | Value |
|---|---|
| **File** | `packages/backend/src/routes/devRoutes.ts:26-29` |
| **Status** | **Good**: requires both `NODE_ENV !== "production"` AND `ENABLE_DEV_ROUTES=true` |
| **Risk** | If `NODE_ENV` is accidentally unset in production, dev routes become available |
| **Mitigation** | Add a startup assertion: if `ENABLE_DEV_ROUTES=true` and `NODE_ENV=production`, refuse to start. Log a warning at boot when dev routes are enabled. |

### 10. Dev routes allow `exec` (command execution) (MEDIUM)

| Detail | Value |
|---|---|
| **File** | `packages/backend/src/routes/dev.ts:8-9,19` |
| **Risk** | `child_process.exec` is imported and used via `execAsync` in dev routes |
| **Impact** | If dev routes leak to production (see #9), this is an RCE vector |
| **Mitigation** | Ensure the `dev.ts` module is never bundled in production builds. Add a build-time check. |

### 11. Supabase demo anon key in test setup (LOW-MEDIUM)

| Detail | Value |
|---|---|
| **File** | `tests/test/setup.ts:27` |
| **Risk** | Hardcoded Supabase demo anon key (`eyJhbGci...`) used as fallback |
| **Status** | Acceptable for local `supabase-demo` but could be mistakenly used against real instances |
| **Mitigation** | Add a guard: if `NODE_ENV !== 'test'`, refuse to use the hardcoded fallback. |

### 12. Oversized files (>500 lines)

| File | Lines | Concern |
|---|---|---|
| `apps/ValyntApp/src/services/ValueFabricService.ts` | 676 | Monolith service — split by domain (capabilities, use-cases, benchmarks) |
| `apps/ValyntApp/src/services/UsageTrackingService.ts` | 489 | Approaching threshold; contains server-role client in browser code |
| `packages/backend/src/server.ts` | 623 | Main server — extract middleware setup, route registration, WebSocket setup |
| `.github/workflows/ci.yml` | 799 | Large CI config — extract reusable workflows |
| `.github/workflows/deploy.yml` | 859 | Large deploy config — extract reusable workflows |
| `packages/backend/src/services/TenantProvisioning.ts` | ~1200+ | Very large — high-risk module; split provisioning, deprovisioning, archival |

---

## Positive Findings (already in place)

| Control | Status | Evidence |
|---|---|---|
| `.gitignore` covers `.env*`, `secrets/` | **Pass** | `.gitignore:22-28` |
| No real API keys/secrets committed | **Pass** | All matches are in test files with mock/example values |
| CORS wildcard rejected at runtime | **Pass** | `packages/backend/src/server.ts:300-301` throws on `*` |
| CSP enabled with nonce support | **Pass** | Production config uses `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'` |
| Helmet middleware in use | **Pass** | Multiple entry points use `helmet()` |
| Dev routes double-gated | **Pass** | Requires `NODE_ENV !== production` + `ENABLE_DEV_ROUTES=true` + host allowlist |
| CI runs `check:browser-provider-secrets` | **Pass** | `.github/workflows/ci.yml:74-75` |
| CI runs RLS tenant isolation tests | **Pass** | `pnpm run test:rls` documented and tested |
| Emergency deploy bypass requires approval + incident ticket | **Pass** | `.github/workflows/deploy.yml:57-80` |
| Secret env vars use `?:` (required) syntax | **Partial** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PGPASSWORD` are required; `DATABASE_URL` has unsafe fallback |
| PII redaction / privacy scrubber | **Pass** | `PrivacyScrubber`, `LLMSanitizer`, `redactSensitive` implemented and tested |
| `service_role` usage documented/justified | **Pass** | Comments like `// service_role:justified` with scope explanations |
| Security headers comprehensive | **Pass** | HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy all configured |

---

## Go/No-Go Pre-Launch Checklist

### Must-Have (Block release)

- [x] **Remove or gate auth bypass** in `SignupPage.tsx` and `LoginPage.tsx` — hardcoded credentials removed, bypass gated behind `import.meta.env.DEV` (fixed 2026-02-28)
- [x] **Enable MFA** — `mfaEnabled` now reads `process.env.MFA_ENABLED === 'true'`; set `MFA_ENABLED=true` in production env (fixed 2026-02-28)
- [x] **Fix CORS default** — removed `*` fallback from `environment.ts:68` and `WebSocketServer.ts:72`; empty default triggers runtime guard (fixed 2026-02-28)
- [x] **CORS origin validation gate** — confirm `CORS_ORIGINS` is set to an explicit allowlist (no `*`) before launch. Documented in `.env.example`. `parseCorsAllowlist` rejects wildcards at startup when `credentials: true`.
- [x] **Docker Compose credential enforcement** — all compose files under `ops/compose/` use `${VAR:?...}` syntax; no hardcoded credentials. Verified in `ops/compose/compose.yml`, `profiles/studio.yml`, `profiles/supabase.yml`.
- [x] **Frontend bundle service-role check** — CI step `Guard frontend bundle service-role identifiers` runs on every PR via `pnpm check:frontend-bundle-service-role`. Blocks `SUPABASE_SERVICE_ROLE_KEY` and `createServerSupabaseClient` in the bundle.
- [ ] **Fix DATABASE_URL fallback** — remove `postgres:postgres` inline default in `compose.yml:31`
- [ ] **Add tenant filter** to `ValueFabricService.ts` frontend queries (`getBenchmarks`, `getOntologyStats`)
- [ ] **Audit `service_role` in browser bundle** — verify `UsageTrackingService.ts` server-only require is not resolved by Vite

### Should-Have (Fix within first sprint post-launch)

- [ ] Bind Postgres port to `127.0.0.1` in compose
- [ ] Add startup assertion: reject `ENABLE_DEV_ROUTES=true` when `NODE_ENV=production`
- [ ] Split oversized files: `TenantProvisioning.ts` (~1200+ lines), `server.ts` (623 lines), `ValueFabricService.ts` (676 lines)
- [ ] Extract reusable GitHub Actions workflows from `ci.yml` (799 lines) and `deploy.yml` (859 lines)
- [ ] Add build-time dead-code assertion that `dev.ts` (exec import) is not in production bundle

### Nice-to-Have (Backlog)

- [ ] Rotate the Supabase demo anon key in `tests/test/setup.ts` to a per-run ephemeral key
- [ ] Add `NODE_ENV` presence assertion at application startup
- [ ] Document `service_role` usage inventory in a single security doc (currently scattered across files)
- [ ] Add SAST scanner (e.g., Semgrep, CodeQL) to CI pipeline for continuous secret/vulnerability scanning

---

*This checklist supplements the existing [Launch Readiness](./launch-readiness.md) runbook. All critical items must be resolved and verified before production traffic is enabled.*


## Mesh identity and principal hardening (agent workloads)

- [ ] Verify no agent deployment uses a shared ServiceAccount (`valynt-agent`).
- [ ] Verify each agent deployment uses `serviceAccountName: <agent-name>-agent`.
- [ ] Run the CI-equivalent gate locally and archive output in go-live evidence:
  ```bash
  node scripts/ci/check-agent-service-accounts.mjs
  ```
- [ ] Verify Istio principals in `infra/k8s/security/mesh-authentication.yaml` follow:
  - `cluster.local/ns/valynt-agents/sa/<agent-name>-agent`
  - `cluster.local/ns/valynt/sa/valynt-backend`
- [ ] If trust domain is customized, explicitly document the non-default domain in release notes and update all AuthorizationPolicy principal values before deploy.
