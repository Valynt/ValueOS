# Repeatable Build Setup

This document outlines the repeatable build configuration for ValueOS.

## Node.js Version Management

The project uses Node.js **20.19.0** as specified in the root `.nvmrc` (mirrored to `.config/.nvmrc` for legacy scripts).

### Automated Setup

Run the quick setup script:

```bash
bash scripts/dev-automation/quick-setup.sh
```

This script will:

1. Read the required Node.js version from `.nvmrc`
2. Automatically install and switch to the correct Node.js version using nvm (if available)
3. Install dependencies with `pnpm install --frozen-lockfile`
4. Set up environment files
5. Generate Prisma client (if present)
6. Configure Git hooks
7. Build the project (best-effort)
8. Run tests (best-effort)

### Manual Node.js Setup

If you need to set up Node.js manually:

```bash
# Install and use Node.js 20.19.0
export NVM_DIR="/usr/local/share/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20.19.0
nvm use 20.19.0
```

## Build Reproducibility

### Dependencies

- Uses `pnpm install --frozen-lockfile` for deterministic dependency installation
- Dependencies are locked in `pnpm-lock.yaml`
- Package manager is pinned via `packageManager: pnpm@9.15.0` in `package.json` (corepack-enabled)

### Environment

- Required Node.js version is explicitly defined in `.nvmrc` (mirrored in `.config/.nvmrc`)
- Environment variables are managed through `.env` files
- Port configurations are in `.env.ports`

### Build Process

- TypeScript compilation with strict type checking
- Deterministic asset generation
- No timestamps or build-time metadata in outputs

## Verification

To verify the repeatable build setup:

```bash
# Check Node.js version
node --version  # Should be v20.19.x

# Check package manager
pnpm --version  # Should be 9.15.x

# Run full build verification (may be heavy)
pnpm run ci:verify

# Run comprehensive checks (DX sweep)
pnpm run dx:check
```

## CI/CD Integration

The repeatable build setup is integrated into CI/CD pipelines through:

- `.github/workflows/` configurations
- Container-based builds with pinned Node.js versions
- Deterministic dependency installation
- Build artifact verification
