# ValueCanvas Repository Structure - Quick Reference

**Quick navigation guide for developers**

## 🚀 Quick Links

| Need | Location | Purpose |
|------|----------|---------|
| **Getting Started** | `docs/getting-started/` | Setup, quickstart, tutorials |
| **Architecture** | `docs/architecture/` | System design, decisions |
| **API Docs** | `docs/api/` | API reference, endpoints |
| **Deployment** | `docs/deployment/` | Deploy procedures, releases |
| **Operations** | `docs/operations/` | Runbooks, monitoring, troubleshooting |
| **Security** | `docs/security/` | Security architecture, policies |
| **Contributing** | `CONTRIBUTING.md` | Code standards, PR process |

## 📁 Where Things Live

### Development
```
src/                       Application code
├── components/            React components
├── services/             Business logic
├── backend/              Express server
├── api/                  API routes
├── types/                TypeScript types
└── lib/                  Shared libraries

tests/                     All tests
├── unit/                 Unit tests
├── integration/          Integration tests
├── e2e/                  End-to-end tests
└── security/             Security tests

config/                    Tool configuration
scripts/dev/              Development scripts
```

### Documentation
```
docs/
├── INDEX.md              Main entry point ⭐
├── README.md             Documentation overview
├── getting-started/      Setup & onboarding
├── architecture/         System design
├── features/             Feature specs
├── api/                  API documentation
├── deployment/           Deployment guides
├── operations/           Runbooks
├── security/             Security docs
└── compliance/           Compliance & governance
```

### Infrastructure
```
infrastructure/
├── infra/infra/docker/               Docker configs
├── infra/infra/k8s/           K8s manifests
├── terraform/            Infrastructure as Code
├── environments/         Environment configs
├── monitoring/           Prometheus, Grafana
└── scripts/              Deployment automation

supabase/                 Database & backend
├── migrations/           Schema changes
├── functions/            Edge functions
└── tests/               Database tests
```

## ✅ Common Tasks

### Getting Started
```bash
# 1. Clone and install
git clone <repo>
npm ci

# 2. Setup database
npm run db:setup

# 3. Start development
npm run dev              # Frontend
npm run backend:dev      # Backend

# See: docs/getting-started/quickstart.md
```

### Running Tests
```bash
# All tests
npm test

# Specific test suite
npm test unit            # Unit tests
npm test integration     # Integration tests
npm test e2e             # E2E tests

# See: docs/getting-started/testing.md
```

### Deploying
```bash
# Deploy to environment
scripts/deploy/deploy-dev.sh      # Dev environment
scripts/deploy/deploy-staging.sh  # Staging environment
scripts/deploy/deploy-prod.sh     # Production

# See: docs/deployment/
```

### Database Migrations
```bash
# Create migration
npm run db:migrate:new "migration_name"

# Apply migrations
npm run db:migrate

# See: docs/deployment/
```

## 📚 Documentation Entry Points

Start here based on what you need:

- **New to the project?** → `docs/getting-started/quickstart.md`
- **Want to understand architecture?** → `docs/architecture/system-overview.md`
- **Deploying to production?** → `docs/deployment/`
- **Having issues?** → `docs/operations/troubleshooting.md`
- **Security questions?** → `docs/security/`
- **Contributing code?** → `CONTRIBUTING.md`

## 🔍 Finding Things

### By Topic
| Topic | Location |
|-------|----------|
| Authentication | `src/backend/auth/` |
| Database | `supabase/` + `docs/architecture/data-layer.md` |
| API | `src/api/` + `docs/api/` |
| UI Components | `src/components/` |
| Business Logic | `src/services/` |
| Deployment | `infrastructure/` + `docs/deployment/` |
| Monitoring | `infrastructure/monitoring/` + `docs/operations/` |

### By File Type
| Type | Location |
|------|----------|
| React Components | `src/components/**/*.tsx` |
| Services | `src/services/**/*.ts` |
| Tests | `tests/**/*.test.ts` |
| Documentation | `docs/**/*.md` |
| Configuration | `config/` or root |
| Scripts | `scripts/` |
| Infrastructure | `infrastructure/` |

## 🎯 File Organization Rules

**Avoid:**
- ❌ Creating .md files at root (→ put in `/docs/`)
- ❌ Putting scripts in root (→ put in `/scripts/`)
- ❌ Mixing test types (→ organize by type in `/tests/`)
- ❌ Configuration in source code (→ put in `/config/`)

**Follow:**
- ✅ One component per file
- ✅ Components under 300 lines
- ✅ Tests co-located with source or in `/tests/`
- ✅ Documentation in `/docs/` organized by category
- ✅ Related files in same directory

## 🔗 Important URLs

- **Main README:** `README.md`
- **Quickstart:** `QUICKSTART.md` or `docs/getting-started/quickstart.md`
- **Testing Guide:** `TESTING.md` or `docs/getting-started/testing.md`
- **Contributing:** `CONTRIBUTING.md`
- **Full Documentation Index:** `docs/INDEX.md`
- **Architecture Decisions:** `docs/architecture/adr/`

## 💡 Pro Tips

1. **Start with docs/INDEX.md** - It's the main entry point to all documentation
2. **Use search** - Most IDEs can search files: `Cmd+P` in VS Code
3. **Check /docs first** - If you can't find something, it's probably documented there
4. **Follow the structure** - Add new files in the appropriate directory
5. **Update docs** - If you change code, update documentation too

## 📞 Need Help?

- **Setup issues?** → `docs/getting-started/troubleshooting.md`
- **Architecture questions?** → `docs/architecture/`
- **Deployment help?** → `docs/deployment/`
- **Development issues?** → Check relevant feature docs in `docs/features/`
- **Still stuck?** → Ask in #engineering on Slack

---

**Last Updated:** December 6, 2025  
**Status:** Reference Guide

