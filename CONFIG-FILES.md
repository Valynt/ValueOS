# Root Configuration Files

This document explains the purpose of each configuration file in the repository root.

## Docker Compose Files

| File | Purpose | Status |
|------|---------|--------|
| `docker-compose.yml` | Legacy wrapper that includes `ops/compose/compose.yml` | **Deprecated** - Use `ops/compose/compose.yml` directly |
| `docker-compose.deps.yml` | Legacy wrapper that includes `ops/compose/compose.yml` | **Deprecated** - Use `ops/compose/compose.yml` directly |
| `compose.devcontainer.override.yml` | DevContainer-specific overrides for port mappings and volumes | Active - Used by DevContainer setup |
| `docker-compose.override.yml` | Local development overrides (gitignored) | Active - Created by `./dev` script |

### Canonical Compose Location
The primary Docker Compose configuration lives at:
- **`ops/compose/compose.yml`** - Core services (backend, frontend, postgres, redis)
- **`ops/compose/profiles/*.yml`** - Optional service profiles (observability, etc.)

## Environment Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Example environment variables for root-level tools |
| `.env.local.example` | Example for local development (committed) |
| `.env.ports.example` | Example port configuration (committed) |
| `ops/env/.env.backend.cloud-dev.example` | Cloud-dev backend environment template |
| `ops/env/.env.backend.local.example` | Local backend environment template |
| `ops/env/.env.production.template` | Production environment template |
| `ops/env/README.md` | **Comprehensive env file documentation** |

### Environment Load Order
1. `ops/env/.env.ports` - Port configuration
2. `ops/env/.env.local` - Local overrides (gitignored, highest priority)
3. Mode-specific files (`.env.backend.local`, `.env.backend.cloud-dev`)

⚠️ **Warning**: `.env.local` silently overrides mode-specific values. Use `pnpm run dx:env --mode <mode> --force` to regenerate.

## Package Manager

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | pnpm workspace configuration (apps/*, packages/*) |
| `pnpm-lock.yaml` | Locked dependency versions |
| `.npmrc` | npm/pnpm registry and behavior settings |
| `.nvmrc` | Node.js version specification (v20) |

## Build & Development

| File | Purpose |
|------|---------|
| `package.json` | Root package scripts and metadata |
| `turbo.json` | Turborepo pipeline configuration |
| `tsconfig.json` | Root TypeScript configuration |
| `tsconfig.*.json` | Specialized TS configs (app, node, scripts, strict-zones) |
| `vite.config.ts` | Vite build configuration |
| `vitest.config.ts` | Vitest test runner configuration |
| `vitest.e2e.config.ts` | E2E test configuration |

## Code Quality

| File | Purpose |
|------|---------|
| `eslint.config.js` | ESLint flat config |
| `prettier.config.js` | Prettier formatting rules |
| `.prettierrc` | Prettier additional config |
| `tailwind.config.cjs` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |

## Git

| File | Purpose |
|------|---------|
| `.gitignore` | Git ignore patterns |
| `.gitattributes` | Git attribute handling |
| `.gitleaks.toml` | Secret scanning configuration |

## IDE/Editor

| File | Purpose |
|------|---------|
| `.vscode-extension/` | Custom VS Code extension for ValueOS |
| `components.json` | shadcn/ui components configuration |

## CI/CD

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | **Primary CI workflow** - lint, test, typecheck, guards |
| `.windsurf/quarantine/workflows-archive-*/` | Quarantined legacy workflows |

## Quick Reference

### Start Development
```bash
./dev up --mode local      # Local mode
./dev up --mode docker     # Docker mode
```

### Run Checks
```bash
pnpm run check             # TypeScript typecheck
pnpm run lint              # ESLint
pnpm test                  # Unit tests
pnpm run dx:check          # Full doctor check
```

### Environment Setup
```bash
pnpm run dx:env --mode local --force    # Generate local env
```

---
**Last Updated**: 2026-03-18  
**Owner**: Platform Team
