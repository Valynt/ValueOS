# Repository Reorganization Action Plan

**Start Date:** December 6, 2025  
**Target Completion:** December 20, 2025  
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines the step-by-step plan to reorganize the ValueCanvas repository according to enterprise best practices. The reorganization will improve developer experience, maintainability, and scalability without disrupting ongoing development.

---

## Phase 1: Documentation Consolidation (Week 1)

### Task 1.1: Audit Current Documentation

**Current State:**
- Root directory: 15+ .md files
- `/docs/` directory: 30+ .md files scattered across multiple subdirectories
- Inconsistent file locations and naming

**Files to Reorganize:**

**Root Level → `/docs/getting-started/`**
- `QUICKSTART.md` → `getting-started/quickstart.md`
- `TESTING.md` → `getting-started/testing-guide.md`

**Root Level → `/docs/deployment/`**
- `README_IMPLEMENTATION.md` → `deployment/implementation-guide.md`
- `RELEASE_NOTES_v1.0.0.md` → `deployment/release-notes-v1.0.0.md`

**Root Level → `/docs/ops/` → Consolidate**
- Keep `/docs/operations/` as primary

**Root Level → `/docs/compliance/`**
- `MULTI_TENANCY_CHECKLIST.md` → `compliance/multi-tenancy-checklist.md`
- `CODE_REVIEW_CHECKLIST.md` → `compliance/code-review-checklist.md`

**Root Level → `/docs/architecture/`**
- `CODE_REFACTORING_PLAN.md` → `archive/code-refactoring-plan.md`

### Task 1.2: Create Missing Subdirectories

```bash
mkdir -p docs/{compliance,getting-started/setup}
mkdir -p docs/archive
mkdir -p infrastructure/docker
mkdir -p infrastructure/environments/{dev,staging,production}
mkdir -p scripts/{dev,build,deploy,maintenance}
mkdir -p tests/{unit,integration,e2e,security}
```

### Task 1.3: Consolidate `/docs/ops/` and `/docs/operations/`

**Action:** Merge into single `/docs/operations/` directory
- Move all files from `/docs/ops/` to `/docs/operations/`
- Update all cross-references
- Delete `/docs/ops/` directory

### Task 1.4: Clean Up `/docs/` Root

**Move to appropriate subdirectories:**
```
docs/INDEX.md                           → Keep (main entry point)
docs/README.md                          → Keep (overview)
docs/FAQ.md                             → /docs/getting-started/faq.md
docs/ACCESSING_DOCUMENTATION.md         → /docs/getting-started/accessing-docs.md
docs/COMMUNICATION_PLAN.md              → /docs/operations/communication-plan.md
docs/TASK_REGISTRY.md                   → /docs/operations/task-registry.md
docs/STANDUP_TEMPLATE.md                → /docs/operations/standup-template.md
docs/REPOSITORY_CLEANUP_REPORT.md       → /docs/archive/cleanup-report-{date}.md
docs/STRATEGIC_VALIDATION_REPORT.md     → /docs/archive/validation-report-{date}.md
```

### Task 1.5: Consolidate Duplicate Documentation

**Identify and consolidate:**
- `docs/DOCUMENTATION_INDEX.md` vs `docs/INDEX.md` → Keep INDEX.md as primary
- `/docs/monitoring/` files vs `/docs/LLM_MONITORING_DASHBOARD.md` → Consolidate
- `/docs/security/` files vs root security docs → Consolidate

---

## Phase 2: Configuration Organization (Week 1-2)

### Task 2.1: Consolidate Docker Compose Files

**Current State:**
```
docker-compose.dev.yml              (at root)
docker-compose.prod.yml             (at root)
docker-compose.stage.yml            (at root)
docker-compose.saml-test.yml        (at root)
infrastructure/docker-compose.*.yml (also at root)
```

**Target State:**
```
infrastructure/docker/
├── docker-compose.dev.yml
├── docker-compose.staging.yml
├── docker-compose.production.yml
├── docker-compose.local-mtls.yml   (from infrastructure/)
├── docker-compose.observability.yml
└── README.md (usage guide)
```

**Actions:**
1. Move all docker-compose files to `/infrastructure/docker/`
2. Update references in package.json scripts
3. Update CI/CD workflows
4. Create README explaining each compose file

### Task 2.2: Consolidate Environment Files

**Current State:**
```
.env.example                (at root)
.env.dev                    (at root)
.env.dev.example            (at root)
.env.prod                   (at root)
.env.production copy.example (at root - malformed)
.env.stage                  (at root)
```

**Target State:**
```
.env.example                (at root - template)
infrastructure/environments/
├── .env.dev
├── .env.staging
├── .env.production
└── .env.local.example      (for local development)
```

**Actions:**
1. Standardize naming (.prod → .production)
2. Move environment-specific files to `/infrastructure/environments/`
3. Keep only `.env.example` at root
4. Update scripts and CI/CD

### Task 2.3: Organize Configuration Files

**Target State:**
```
config/                     (already exists)
├── eslint.config.js        (move from root)
├── tailwind.config.js      (move from root)
├── postcss.config.js       (move from root)
├── vite.config.ts          (move from root)
├── vitest.config.ts        (move from root)
├── tsconfig.json           (keep at root - npm expects it)
├── ui-registry.json        (already here - good)
└── README.md               (config reference)
```

**Keep at Root (Standard npm/TypeScript Locations):**
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`
- `.env.example`

---

## Phase 3: Script Organization (Week 2)

### Task 3.1: Audit Existing Scripts

**Current State:**
```
Root directory:
├── cleanup.sh
├── consolidate.sh
├── dev-setup.sh
├── start-docker.sh
├── start.sh
├── final_cleanup.sh

Tests scripts in /tests/
Build scripts referenced in package.json
```

**Actions:**
1. Identify purpose of each script
2. Categorize by type
3. Plan migration to `/scripts/` subdirectories

### Task 3.2: Create Script Directory Structure

```
scripts/
├── README.md                    # Scripts guide
├── dev/
│   ├── setup.sh                # Local dev setup
│   ├── seed-db.sh              # Seed database
│   └── reset-local.sh           # Reset local environment
├── build/
│   ├── build.sh                # Build application
│   ├── build-docker.sh          # Build Docker image
│   └── generate-types.sh        # Generate TypeScript types
├── deploy/
│   ├── deploy-dev.sh            # Deploy to dev
│   ├── deploy-staging.sh        # Deploy to staging
│   ├── deploy-prod.sh           # Deploy to production
│   └── rollback.sh              # Rollback deployment
├── maintenance/
│   ├── cleanup.sh               # Clean up temporary files
│   ├── migrate-db.sh            # Run database migrations
│   └── backup-db.sh             # Backup database
└── security/
    ├── scan-secrets.sh          # Scan for secrets
    ├── generate-certs.sh        # Generate TLS certs
    └── rotate-keys.sh           # Rotate API keys
```

### Task 3.3: Migrate Scripts

1. Move existing scripts to appropriate subdirectories
2. Add script headers with documentation
3. Update package.json to reference new locations
4. Update CI/CD workflows to reference new locations
5. Create `/scripts/README.md` with usage guide

---

## Phase 4: Test Organization (Week 2-3)

### Task 4.1: Audit Current Tests

**Current State:**
```
/test/                      (directory)
/tests/                     (directory)
src/                        (inline .test.ts files)
```

**Actions:**
1. Count and categorize tests
2. Identify test types (unit, integration, e2e)
3. Plan consolidation

### Task 4.2: Consolidate Test Structure

```
tests/
├── README.md               # Testing guide
├── unit/                   # Unit tests (no dependencies)
├── integration/            # Integration tests (with services)
├── e2e/                    # End-to-end tests (full flows)
├── performance/            # Load and performance tests
├── security/               # Security tests
├── fixtures/               # Test data and factories
│   ├── users.ts
│   ├── cases.ts
│   └── ...
└── setup.ts                # Shared test setup
```

### Task 4.3: Update Test Configuration

1. Update `vitest.config.ts` to reference new test location
2. Update `package.json` test scripts
3. Update CI/CD test references
4. Create test documentation

---

## Phase 5: Infrastructure Organization (Week 3)

### Task 5.1: Consolidate Infrastructure Files

**Target State:**
```
infrastructure/
├── README.md
├── docker/
│   ├── docker-compose.*.yml
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── README.md
├── kubernetes/
│   ├── base/
│   ├── overlays/
│   └── README.md
├── terraform/
│   ├── modules/
│   ├── environments/
│   └── README.md
├── environments/
│   ├── .env.dev
│   ├── .env.staging
│   ├── .env.production
│   └── README.md
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── README.md
├── logging/
│   └── README.md
├── security/
│   ├── tls/
│   ├── mTLS/
│   └── README.md
└── scripts/
    └── deployment/
```

### Task 5.2: Update References

1. Update CI/CD workflows (.github/workflows/*.yml)
2. Update package.json scripts
3. Update documentation links
4. Update deployment scripts

---

## Phase 6: Root Directory Cleanup (Week 3)

### Task 6.1: Move Artifacts and Temporary Files

```bash
# Move test reports
mkdir -p reports/test
mv playwright-report/ reports/test/

# Move build artifacts
mkdir -p build/
# (Already documented in .gitignore)

# Archive old files
mkdir -p archive/
mv {old-files} archive/
```

### Task 6.2: Final Root Directory

**Keep in Root:**
```
.devcontainer/
.github/
.gitignore
.vscode/
.windsurf/
.pre-commit-config.yaml
CHANGELOG.md
CONTRIBUTING.md
LICENSE
README.md
QUICKSTART.md
TESTING.md
build-manifest.json
docker-compose.yml              (link to local dev setup)
index.html
index.production.html
openapi.yaml
package.json
package-lock.json
tsconfig.json
.env.example
src/
docs/
infrastructure/
supabase/
migrations/
tests/
scripts/
config/
public/
```

**Remove from Root:**
- Individual .md files (move to `/docs/`)
- Utility scripts (move to `/scripts/`)
- Docker compose files except main one (move to `/infrastructure/docker/`)
- Environment files except template (move to `/infrastructure/environments/`)
- Blueprint/ (move to archive or separate repo)
- Portaldraft/ (move to archive)

---

## Implementation Guide

### Before Starting
1. Create new branch: `git checkout -b reorganize/enterprise-structure`
2. Backup current structure: `git tag backup-pre-restructure`
3. Get team approval

### For Each Phase
1. Create subdirectories
2. Copy/move files
3. Update cross-references
4. Test that everything works
5. Commit with clear messages
6. Create PR for review

### After Completion
1. Update contributing guide
2. Document new structure in README
3. Train team on new organization
4. Monitor for issues

---

## File Move Reference

### Documentation Files

| Current | Target | Reason |
|---------|--------|--------|
| `QUICKSTART.md` | `docs/getting-started/quickstart.md` | Onboarding guide |
| `TESTING.md` | `docs/getting-started/testing.md` | Testing documentation |
| `CONTRIBUTING.md` | Keep at root | Developer reference |
| `README_IMPLEMENTATION.md` | `docs/deployment/implementation.md` | Deployment guide |
| `RELEASE_NOTES_v1.0.0.md` | `docs/deployment/release-notes/` | Version history |
| `README_IMPLEMENTATION.md` | Archive | Superseded |

### Configuration Files

| Current | Target | Reason |
|---------|--------|--------|
| `docker-compose.dev.yml` | `infrastructure/docker/` | Environment-specific |
| `docker-compose.prod.yml` | `infrastructure/docker/` | Environment-specific |
| `.env.prod` | `infrastructure/environments/` | Sensitive, environment-specific |
| `eslint.config.js` | `config/` | Tool configuration |

### Scripts

| Current | Target | Reason |
|---------|--------|--------|
| `dev-setup.sh` | `scripts/dev/setup.sh` | Development utility |
| `cleanup.sh` | `scripts/maintenance/cleanup.sh` | Maintenance utility |
| `start.sh` | `scripts/dev/start.sh` | Development utility |

---

## Rollback Plan

If issues arise during reorganization:

```bash
# Restore from backup tag
git checkout backup-pre-restructure
git push -f origin main

# Or revert specific commits
git revert {commit-hash}
```

---

## Success Criteria

✅ All root `.md` files consolidated to `/docs/`  
✅ All configuration files organized  
✅ All scripts organized in `/scripts/`  
✅ All tests consolidated in `/tests/`  
✅ All cross-references updated  
✅ CI/CD pipelines still work  
✅ Developer experience improved  
✅ No broken links or imports  
✅ All team members trained  

---

## Timeline & Owners

| Phase | Tasks | Estimated Time | Owner |
|-------|-------|-----------------|-------|
| 1 | Documentation | 2-3 days | Tech Lead |
| 2 | Configuration | 1-2 days | DevOps |
| 3 | Scripts | 1 day | Engineering |
| 4 | Tests | 2 days | QA |
| 5 | Infrastructure | 2 days | DevOps |
| 6 | Cleanup | 1 day | Tech Lead |

**Total Estimated Time:** 9-11 days (across all phases)

---

## Communication Plan

1. **Day 0:** Share this plan with team
2. **Day 1:** Get approval, create feature branch
3. **Daily:** Short updates in #engineering Slack
4. **End of Phase:** Demonstrate changes
5. **After Completion:** Team training on new structure

---

## References

- [Monorepo Best Practices](https://monorepo.tools/)
- [Google's Repository Best Practices](https://google.github.io/styleguide/)
- [12 Factor App](https://12factor.net/)
- [Software Engineering at Google](https://abseil.io/resources/swe-book/)

