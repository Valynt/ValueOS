---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Launch Readiness

**Last updated:** 2026-03-17
**Maintained by:** Engineering — update blockers as they are resolved; move resolved items to the Resolved section with a PR reference.

---

## Scope

- Supporting checklist: [Release Readiness SWAT Team Checklist](./release-readiness-swat-checklist.md)
- **App / version:** ValueOS — ValyntApp + backend API
- **Target environment:** cloud-dev (Gitpod/Ona + hosted Supabase)
- **Required user flows:** login, opportunity creation, hypothesis generation, business case view
- **Out of scope for this launch:** VOSAcademy, mcp-dashboard, local Docker Compose path

---

## Blockers

These must be resolved before launch. Each is a true boot or critical-path failure.

~~- [ ] `TCT_SECRET` and `WEB_SCRAPER_ENCRYPTION_KEY` are required at backend startup but not mentioned in the README quickstart or validated in `validateEnv.ts` — a new engineer will hit a silent crash with no actionable message.~~ ✅ Resolved — see Resolved section.

~~- [ ] `SUPABASE_KEY` (alias for `SUPABASE_ANON_KEY`) is read by three backend files but is not listed as a required var anywhere visible to a new engineer — backend crashes at startup with `supabaseKey is required`.~~ ✅ Resolved — see Resolved section.

~~- [ ] `scripts/dx/doctor.js` crashes with `printToolVersions is not defined` — the preflight check exits non-zero before completing any checks.~~ ✅ Resolved — see Resolved section.

---

## Launch-safe known issues

These are real issues but do not block launch. Track and fix post-launch.

- [ ] `docs/environments/local-development.md` describes a Docker Compose stack that is not the primary dev target — confusing for new engineers but not a boot blocker.
- [ ] Root `.env.example` and `.env.local.example` still exist at repo root — demoted with header comments but could still mislead engineers who don't read the comments.
- [ ] `scripts/` directory contains ~150 scripts with no index or README — tribal knowledge required to find the right script.
- [ ] README Key Commands table previously listed `pnpm run db:push` (non-existent) — now fixed, but other commands in the table have not been verified from a clean environment.

---

## Post-launch work

Freeze until after launch.

- [ ] Migrate `MemorySystem` from in-process store to pgvector
- [ ] Replace `UnifiedAgentOrchestrator` references in any remaining docs
- [ ] Mass `any` type cleanup across unrelated modules
- [ ] Rewrite `scripts/dx/doctor.js` with full preflight coverage

---

## Commands

All commands verified to exist in root `package.json`:

| Purpose | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Start frontend + backend | `pnpm run dev` |
| Start backend only | `pnpm run dev:backend` |
| Start frontend only | `pnpm run dev:frontend` |
| Run unit tests | `pnpm test` |
| Run RLS security tests | `pnpm run test:rls` |
| Build for production | `pnpm run build` |
| Apply database migrations | `pnpm run db:migrate` |
| Run preflight env checks | `pnpm run dx:check` |
| TypeScript typecheck | `pnpm run check` |
| Lint | `pnpm run lint` |

---

## Environment variables

Full reference: [ops/env/README.md](../ops/env/README.md)

### cloud-dev (primary)

| Variable | Required | Source |
|---|---|---|
| `SUPABASE_URL` | ✅ required | Supabase dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | ✅ required | Supabase dashboard → Project Settings → API |
| `SUPABASE_KEY` | ✅ required | Same value as `SUPABASE_ANON_KEY` (alias) |
| `SUPABASE_PROJECT_REF` | ✅ required | Supabase dashboard → Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ required (backend) | Supabase dashboard → Project Settings → API |
| `DATABASE_URL` | ✅ required (backend) | Supabase dashboard → Project Settings → Database |
| `TCT_SECRET` | ✅ required (backend) | Generate: `openssl rand -hex 32` |
| `WEB_SCRAPER_ENCRYPTION_KEY` | ✅ required (backend) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | optional | App degrades gracefully when absent |
| `TOGETHER_API_KEY` | optional | Required for LLM agent features |

---

## Smoke test

Run after each deploy to confirm the system is healthy.

- [ ] `GET /health` returns `200 OK` with `{"status":"ok"}` — confirms backend is up and DB connection is live
- [ ] Frontend loads at the app URL without a blank screen or JS error in the console
- [ ] Login flow completes: enter credentials → redirect to dashboard → user name visible in nav
- [ ] Opportunity creation: create a new opportunity → it appears in the list
- [ ] Hypothesis generation: trigger agent on an opportunity → response appears within 30s
- [ ] `GET /health/secrets/public` returns `200` — confirms secret hydration succeeded

---

## Resolved

| Item | Resolved in |
|---|---|
| `pnpm run db:push` in README (script does not exist) | PR #1753 |
| README quickstart pointed to root `.env.example` instead of `ops/env/` | PR #1753 |
| `pnpm run dx:check` not available as a script | PR #1753 |
| `TCT_SECRET` missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `WEB_SCRAPER_ENCRYPTION_KEY` missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `SUPABASE_KEY` alias missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `scripts/dx/doctor.js` crashes with `printToolVersions is not defined` | PR #1755 |

---

## Sprint 5 — Final Launch Checklist

**Status gate:** All items must be ✅ before GA deployment is approved.
**Owner:** Engineering lead signs off each section.

### 1. Agent containerization

| Agent | K8s Deployment | Service | PDB | HPA | ServiceAccount |
|---|---|---|---|---|---|
| OpportunityAgent | ✅ | ✅ | ✅ | ✅ (core-lifecycle-hpa.yaml) | ✅ |
| TargetAgent | ✅ | ✅ | ✅ | ✅ (core-lifecycle-hpa.yaml) | ✅ |
| FinancialModelingAgent | ✅ | ✅ | ✅ | ✅ (analysis-agents-hpa.yaml) | ✅ |
| IntegrityAgent | ✅ | ✅ | ✅ | ✅ (core-lifecycle-hpa.yaml) | ✅ |
| RealizationAgent | ✅ | ✅ | ✅ | ✅ (core-lifecycle-hpa.yaml) | ✅ |
| ExpansionAgent | ✅ | ✅ | ✅ | ✅ (core-lifecycle-hpa.yaml) | ✅ |
| NarrativeAgent | ✅ | ✅ | ✅ | ✅ (remaining-agents-hpa-part2.yaml) | ✅ |
| GroundTruthAnalyzer | ✅ | ✅ | ✅ | ✅ (remaining-agents-hpa-part2.yaml) | ✅ |
| ComplianceAuditorAgent | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 |
| ContextExtractionAgent | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 |
| DealAssemblyAgent | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 |
| DiscoveryAgent | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 | ✅ Sprint 5 |

All 11 canonical agents + GroundTruthAnalyzer are containerized. Kustomization updated in `infra/k8s/base/agents/kustomization.yaml`.

**Verify:** `kubectl get deployments -n valynt-agents | wc -l` should return ≥ 22 (18 agent dirs + extended fabric).

### 2. Frontend bundle budget

| Metric | Budget | Status |
|---|---|---|
| Max chunk size | 500 KB | ✅ Enforced via `performanceBudgetPlugin` |
| Max initial JS | 1200 KB | ✅ Enforced via `performanceBudgetPlugin` |
| Rollup warning threshold | 500 KB | ✅ `chunkSizeWarningLimit: 500` |
| `vendor-canvas` chunk (ReactFlow + elkjs) | Lazy-loaded | ✅ Only fetched on Value Graph tab |
| `vendor-motion` chunk (framer-motion) | Separate chunk | ✅ Not in initial bundle |
| `vendor-markdown` chunk | Separate chunk | ✅ Not in initial bundle |

**Verify:** `pnpm --filter ValyntApp build` must complete without budget plugin errors.

### 3. Frontend accessibility (WCAG 2.1 AA)

| Component | Fix | Status |
|---|---|---|
| CommandPalette | `aria-live` result count announcements | ✅ Sprint 5 |
| CommandPalette | `role="dialog"`, `aria-modal`, `aria-label` | ✅ Pre-existing |
| CommandPalette | Focus returns to trigger on close | ✅ Pre-existing (`previousFocusRef`) |
| CommandPalette | Keyboard navigation (↑↓ Enter Esc) | ✅ Pre-existing |
| NotificationCenter panel | `role="dialog"`, `aria-modal`, `aria-label` | ✅ Sprint 5 |
| NotificationCenter panel | Focus moves into panel on open; restored on close | ✅ Sprint 5 |
| NotificationCenter panel | Escape key closes panel | ✅ Sprint 5 |
| NotificationCenter bell | `aria-label`, `aria-expanded`, `aria-haspopup` | ✅ Sprint 5 |
| NotificationCenter items | `role="button"`, `tabIndex`, `onKeyDown` | ✅ Sprint 5 |
| NotificationCenter filters | `aria-pressed` state | ✅ Sprint 5 |
| NotificationCenter backdrop | `aria-hidden="true"` | ✅ Sprint 5 |
| Decorative icons | `aria-hidden="true"` throughout | ✅ Sprint 5 |

**Verify:** Run `pnpm --filter ValyntApp lint` — no new a11y ESLint violations.

### 4. Disaster recovery

| Check | Target | Status |
|---|---|---|
| DR script (`scripts/dr-validate.sh`) | All three environments implemented | ✅ Complete |
| `local` environment | pg_dump/restore against Supabase Docker | ✅ |
| `staging` environment | pg_dump/restore against `STAGE_DATABASE_URL` | ✅ |
| `rds-snapshot` environment | Full RDS snapshot restore + RTO measurement | ✅ |
| Failover simulation (`--simulate-failover`) | Healthcheck endpoint validated | ✅ |
| Rollback validation (`--validate-rollback`) | Row-count parity confirmed | ✅ |
| RTO target | < 30 min (per `docs/runbooks/disaster-recovery.md`) | ✅ Enforced in script |
| GitHub Actions workflow | `dr-validation.yml` — weekly + manual dispatch | ✅ Fixed (checkout@v4, upload-artifact@v4) |
| Job summary | Markdown summary written to `$GITHUB_STEP_SUMMARY` | ✅ Sprint 5 |
| Artifact retention | 90 days | ✅ Sprint 5 |
| DR drill log | Entry added for Sprint 5 drill | ✅ `docs/operations/dr-drill-log.md` |

**Verify:** Trigger `.github/workflows/dr-validation.yml` manually against `staging`.

### 5. Security

| Check | Status | Notes |
|---|---|---|
| `pnpm audit` — production runtime vulnerabilities | ✅ 0 found | All 31 advisories are dev-only |
| Previously reported CRITICAL-001 (jspdf) | ✅ Resolved | No longer flagged |
| Previously reported HIGH-002/003 (undici) | ✅ Resolved | No longer flagged |
| Remaining dev-only advisories (handlebars, flatted, etc.) | ⚠️ Tracked | No production exposure; resolve via `pnpm update` post-launch |
| RLS policies | ✅ | Validated by `pnpm run test:rls` |
| Tenant isolation | ✅ | Every query includes `organization_id` / `tenant_id` |
| Secret rotation workflow | ✅ | `.github/workflows/secret-rotation-verification.yml` |
| CodeQL analysis | ✅ | `.github/workflows/codeql.yml` |
| Secret scanning | ✅ | `.github/workflows/secret-scan.yml` + `.gitleaks.toml` |
| OPA sidecar on all agent pods | ✅ | All 22 agent deployments include `opa-ext-authz` container |
| Envoy auth-proxy on all agent pods | ✅ | All 22 agent deployments include `auth-proxy` container |

**Verify:** `pnpm audit --audit-level high` — confirm 0 production-path findings.

### 6. Pre-deployment gates

Run these in order before cutting the GA release tag:

```bash
# 1. Full test suite
pnpm test

# 2. RLS security tests
pnpm run test:rls

# 3. TypeScript typecheck
pnpm run check

# 4. Lint
pnpm run lint

# 5. Production build (enforces bundle budget)
pnpm --filter ValyntApp build

# 6. Security audit — must show 0 production vulnerabilities
pnpm audit --audit-level high

# 7. DR validation against staging
bash scripts/dr-validate.sh staging --simulate-failover --validate-rollback

# 8. Smoke test against staging
bash scripts/pre-deployment-checklist.sh
```

### 7. Go / No-Go sign-off

| Area | Owner | Status |
|---|---|---|
| All 11+ agents containerized and kustomization valid | Platform | ☐ |
| Bundle budget passes on production build | Frontend | ☐ |
| Accessibility audit — no new violations | Frontend | ☐ |
| DR drill completed against staging | Platform | ☐ |
| Security audit — 0 production vulnerabilities | Security | ☐ |
| All pre-deployment gate commands pass | Engineering lead | ☐ |
| Smoke test passes on staging | QA | ☐ |
| Rollback plan documented and tested | Platform | ☐ |

**GA deployment is approved when all rows above are checked.**
