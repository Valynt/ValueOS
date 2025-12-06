# ValueCanvas Repository Structure - Enterprise Best Practices

**Last Updated:** December 6, 2025  
**Status:** Implementation Guide for Enterprise Organization

---

## Executive Summary

This document outlines the enterprise-standard repository organization for ValueCanvas. The structure follows industry best practices for monorepo organization, security, scalability, and developer experience.

---

## Directory Structure Overview

```
ValueCanvas/
├── .github/                          # GitHub Actions, PR templates, bot configs
├── .devcontainer/                    # Dev container configuration
├── .vscode/                          # VS Code settings and extensions
│
├── docs/                             # 📚 DOCUMENTATION (Primary)
│   ├── INDEX.md                      # Main documentation entry point
│   ├── README.md                     # Docs overview
│   ├── getting-started/              # Onboarding guides
│   ├── architecture/                 # System design documents
│   ├── features/                     # Feature specifications
│   ├── api/                          # API documentation
│   ├── user-guide/                   # End-user documentation
│   ├── deployment/                   # Deployment procedures
│   ├── operations/                   # Operational runbooks
│   ├── security/                     # Security documentation
│   ├── compliance/                   # Compliance documentation
│   ├── monitoring/                   # Observability guides
│   └── adr/                          # Architectural Decision Records
│
├── src/                              # 🔧 APPLICATION SOURCE CODE
│   ├── components/                   # React components
│   ├── pages/                        # Page components
│   ├── services/                     # Business logic services
│   ├── lib/                          # Shared libraries
│   ├── utils/                        # Utility functions
│   ├── hooks/                        # React hooks
│   ├── types/                        # TypeScript types
│   ├── backend/                      # Backend services (Express)
│   ├── api/                          # API layer
│   ├── config/                       # Configuration
│   ├── styles/                       # Global styles
│   └── sdui/                         # Server-driven UI system
│
├── infrastructure/                   # 🏗️ INFRASTRUCTURE & DEPLOYMENT
│   ├── README.md                     # Infrastructure overview
│   ├── environments/                 # Environment configs
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   ├── terraform/                    # IaC (Terraform)
│   │   ├── modules/
│   │   ├── environments/
│   │   └── variables.tf
│   ├── kubernetes/                   # K8s manifests
│   │   ├── base/
│   │   └── overlays/
│   ├── docker/                       # Docker configurations
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   └── docker-compose.*.yml
│   ├── scripts/                      # Deployment scripts
│   ├── monitoring/                   # Prometheus, Grafana configs
│   ├── logging/                      # Log aggregation configs
│   └── security/                     # TLS, mTLS, security configs
│
├── supabase/                         # 🗄️ DATABASE & BACKEND SERVICES
│   ├── README.md
│   ├── migrations/                   # Database migrations
│   │   └── versions/
│   ├── tests/                        # Database tests (RLS, policies)
│   ├── functions/                    # Supabase Edge Functions
│   ├── seeds/                        # Database seeds
│   └── config.toml                   # Supabase config
│
├── migrations/                       # 📊 DATABASE SCHEMAS
│   └── *.sql                         # SQL migrations
│
├── tests/                            # ✅ TEST SUITE
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   ├── e2e/                          # End-to-end tests
│   ├── performance/                  # Performance tests
│   ├── security/                     # Security tests
│   └── fixtures/                     # Test data
│
├── scripts/                          # 📝 BUILD & UTILITY SCRIPTS
│   ├── dev/                          # Development scripts
│   ├── build/                        # Build scripts
│   ├── deploy/                       # Deployment scripts
│   ├── maintenance/                  # Maintenance tasks
│   └── security/                     # Security scripts
│
├── config/                           # ⚙️ APPLICATION CONFIGURATION
│   ├── ui-registry.json              # SDUI component registry
│   ├── eslint.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── tsconfig.json
│
├── public/                           # 🎨 STATIC ASSETS
│   ├── index.html
│   ├── favicon.ico
│   └── ...
│
├── .github/workflows/                # 🔄 CI/CD PIPELINES
│   ├── secure-ci.yml                 # Main CI pipeline
│   ├── deploy-*.yml                  # Deployment pipelines
│   └── ...
│
├── CHANGELOG.md                      # Version history
├── CONTRIBUTING.md                   # Contribution guidelines
├── LICENSE                           # License
├── README.md                         # Project README
├── QUICKSTART.md                     # Quick start guide
├── TESTING.md                        # Testing documentation
│
├── package.json                      # Node.js dependencies
├── package-lock.json
├── tsconfig.json                     # TypeScript config
├── .gitignore
├── .env.example                      # Environment template
└── docker-compose.*.yml              # Docker Compose configs
```

---

## Directory Purpose and Guidelines

### 📁 Core Directories

#### `/docs` - Documentation Hub
**Purpose:** Single source of truth for all documentation  
**Organization:**
- `INDEX.md` - Main entry point linking all documentation
- `getting-started/` - Onboarding, setup, quick starts
- `architecture/` - System design, diagrams, decisions
- `features/` - Feature specifications and guides
- `api/` - API reference and usage examples
- `user-guide/` - End-user documentation
- `deployment/` - Deployment procedures and checklists
- `operations/` - Runbooks, monitoring, troubleshooting
- `security/` - Security architecture, policies
- `compliance/` - Compliance, audit, governance
- `monitoring/` - Observability, dashboards, alerting
- `adr/` - Architectural Decision Records

**Best Practices:**
- Every file in `/docs` should be linkable from `INDEX.md`
- Use consistent naming: `feature-name.md`
- Include metadata headers (author, date, status)
- Keep docs DRY (don't repeat content)
- Update docs before code goes to production

#### `/src` - Application Source Code
**Purpose:** All application source code  
**Organization by layer:**
- Frontend components, pages, hooks → React code
- Services → Business logic
- Backend → Express server
- API → API routes and handlers
- Types → TypeScript definitions

**Best Practices:**
- One component per file
- Group related components in folders
- Keep components under 300 lines
- Tests co-located with source (`Component.test.ts`)
- No business logic in components

#### `/infrastructure` - Deployment & Infrastructure
**Purpose:** Infrastructure as Code and deployment automation  
**Organization:**
- `environments/` - Environment-specific configs (dev/staging/prod)
- `terraform/` - Terraform modules and root configurations
- `kubernetes/` - K8s manifests (base + overlays)
- `docker/` - Docker build files
- `scripts/` - Deployment automation
- `monitoring/` - Prometheus, Grafana, observability
- `logging/` - Log aggregation, retention
- `security/` - TLS certs, mTLS policies

**Best Practices:**
- Never commit secrets (use secret manager)
- Use environment-specific configs
- Version control IaC (Terraform, K8s)
- Keep environments in sync
- Test IaC before deploying

#### `/supabase` - Database & Backend Services
**Purpose:** Database schema, migrations, and backend functions  
**Organization:**
- `migrations/` - Versioned schema changes
- `tests/` - Database tests (RLS policies, security)
- `functions/` - Supabase Edge Functions
- `seeds/` - Sample data for development

**Best Practices:**
- One migration per change
- Always write test for RLS policies
- Use consistent naming conventions
- Document database schema changes
- Test migrations before production

#### `/tests` - Comprehensive Test Suite
**Purpose:** All tests organized by type  
**Organization:**
- `unit/` - Unit tests (mocking, no dependencies)
- `integration/` - Integration tests (with services)
- `e2e/` - End-to-end tests (full user flows)
- `performance/` - Load and performance tests
- `security/` - Security and penetration tests
- `fixtures/` - Test data and factories

**Best Practices:**
- Aim for 80%+ code coverage
- Write tests before code (TDD)
- Mock external services
- Use factories for test data
- Keep tests fast and isolated

#### `/scripts` - Utility Scripts
**Purpose:** Development, build, and deployment automation  
**Organization:**
- `dev/` - Development helpers
- `build/` - Build automation
- `deploy/` - Deployment scripts
- `maintenance/` - Database migrations, cleanup
- `security/` - Security scanning, key rotation

**Best Practices:**
- Make scripts idempotent
- Log all operations
- Use error handling
- Document script purpose
- Make scripts executable (`chmod +x`)

#### `/config` - Application Configuration
**Purpose:** Configuration files in one place  
**Contains:**
- Tool configurations (ESLint, Tailwind, Vite)
- TypeScript configs
- SDUI registry

**Best Practices:**
- Separate by environment in `.env`
- Use config validation
- Document all env vars
- Never commit `.env` (use `.env.example`)

### 📁 Root Level Files

**Keep in root:**
- `README.md` - Project overview and quick links
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - License file
- `QUICKSTART.md` - 5-minute setup guide
- `TESTING.md` - Testing documentation
- `package.json` - Node dependencies
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Git ignore rules
- `.env.example` - Environment template
- `docker-compose.yml` - Local development setup

**Avoid in root:**
- ❌ Multiple markdown files for similar topics (consolidate to `/docs`)
- ❌ Configuration files not referenced in `package.json`
- ❌ Temporary or experimental files
- ❌ Build artifacts or dependencies
- ❌ Backups or duplicate files

---

## Current State Analysis

### Issues Found

1. **Documentation Scattered**
   - Multiple root-level .md files that should be in `/docs`
   - Inconsistent organization in `/docs` (some files at root, some in subdirectories)

2. **Configuration Confusion**
   - Multiple `.env.example` files
   - `docker-compose.*.yml` at root and in `/infrastructure`

3. **Scripts Scattered**
   - Build/cleanup scripts at root instead of `/scripts`

4. **Test Organization**
   - Tests in `/test`, `/tests`, and inline with source
   - Inconsistent test structure

### Recommended Actions (Priority Order)

#### Phase 1: Documentation Consolidation ⭐ (Immediate)
1. Move all root `.md` files to appropriate `/docs` subdirectories
2. Update `docs/INDEX.md` to be single source of truth
3. Consolidate scattered documentation
4. Remove redundant documentation

#### Phase 2: Configuration Organization (High Priority)
1. Consolidate `.env` files in root and `/infrastructure`
2. Centralize docker-compose files
3. Clean up root directory

#### Phase 3: Script Organization (Medium Priority)
1. Move build/deployment scripts to `/scripts`
2. Organize by purpose (dev, build, deploy)
3. Add script documentation

#### Phase 4: Test Reorganization (Medium Priority)
1. Consolidate tests into `/tests` directory
2. Organize by test type (unit, integration, e2e)
3. Update test configuration

---

## File Naming Conventions

### Documentation Files
```
feature-name.md              # Feature documentation
architecture-overview.md     # Architecture docs
deployment-procedure.md      # Deployment guides
api-reference.md            # API documentation
troubleshooting-guide.md    # Troubleshooting
```

### Configuration Files
```
.env.example                # Template (always in root)
.env.{environment}          # Environment-specific (in /infrastructure/environments/)
{tool}.config.ts            # Tool configs (in /config)
```

### Markdown Files in Docs
```
docs/
├── getting-started/
│   ├── quickstart.md
│   ├── installation.md
│   └── first-deployment.md
├── architecture/
│   ├── system-overview.md
│   ├── data-flow.md
│   └── security-architecture.md
└── operations/
    ├── deployment.md
    ├── monitoring.md
    └── incident-response.md
```

---

## Maintenance & Governance

### Documentation Governance
- **Owner:** Tech lead or documentation team
- **Review:** All doc changes reviewed in PR
- **Update:** Docs updated before code release
- **Archival:** Move old docs to `/docs/archive/` with date

### Configuration Governance
- **Owner:** DevOps / Infrastructure team
- **Review:** Infrastructure changes reviewed
- **Testing:** All IaC tested in staging first
- **Versioning:** Tag releases with version

### Test Governance
- **Owner:** QA / Testing team
- **Minimum Coverage:** 80% code coverage
- **CI/CD Gate:** Tests must pass before merge
- **Performance:** Monitor test performance

### Root Directory Governance
- **Max files:** 20 in root (excluding configs)
- **Move to `/docs`:** After 2 uses or length > 100 lines
- **Archive:** Year-old, unused files moved to `/archive`

---

## Migration Path

### Step 1: Documentation (This PR)
```
Root .md files with documentation purposes →  /docs/{category}/
Example: TESTING.md → /docs/getting-started/testing-guide.md
```

### Step 2: Configuration
```
docker-compose.*.yml → /infrastructure/docker/
.env files → /infrastructure/environments/
Config files → /config/
```

### Step 3: Scripts
```
*.sh files at root → /scripts/{category}/
Example: cleanup.sh → /scripts/maintenance/cleanup.sh
```

### Step 4: Tests
```
/test/* → /tests/unit/
/tests/* → consolidate with proper organization
Inline tests → keep with source, move copy to /tests
```

---

## Benefits of This Structure

✅ **Scalability**: Easy to add new components, services, docs  
✅ **Discoverability**: Clear organization, easy to find things  
✅ **Maintainability**: Related files grouped together  
✅ **Onboarding**: New developers understand structure quickly  
✅ **Governance**: Clear ownership and review processes  
✅ **Security**: Infrastructure and secrets organized separately  
✅ **CI/CD**: Automated tools can easily find configs  
✅ **Documentation**: Single source of truth  

---

## References & Standards

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Architecture Decision Records (ADR)](https://adr.github.io/)
- [Monorepo Best Practices](https://monorepo.tools/)
- [12 Factor App](https://12factor.net/)
- [Infrastructure as Code Best Practices](https://www.terraform.io/cloud-docs/recommended-practices)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

---

## Implementation Timeline

**Phase 1 (This Sprint):**
- Document current structure
- Plan reorganization
- Create this guide

**Phase 2 (Next Sprint):**
- Move documentation files
- Update cross-references
- Verify links work

**Phase 3 (Sprint+1):**
- Consolidate configurations
- Move scripts to `/scripts`

**Phase 4 (Sprint+2):**
- Reorganize tests
- Update CI/CD references

---

**Next Steps:**
1. Review this structure with team
2. Get approval to proceed
3. Create PR with proposed changes
4. Update CI/CD pipelines accordingly
5. Communicate changes to team
6. Update contributing guidelines

