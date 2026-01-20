# Repeatable Build Setup

This document outlines the repeatable build configuration for ValueOS.

## Node.js Version Management

The project uses Node.js version 22 as specified in `.config/.nvmrc`.

### Automated Setup

Run the quick setup script:

```bash
bash scripts/dev-automation/quick-setup.sh
```

This script will:

1. Read the required Node.js version from `.config/.nvmrc`
2. Automatically install and switch to the correct Node.js version using nvm
3. Install dependencies with `npm ci`
4. Set up environment files
5. Generate Prisma client
6. Configure Git hooks
7. Build the project
8. Run tests

### Manual Node.js Setup

If you need to set up Node.js manually:

```bash
# Install and use Node.js 22
export NVM_DIR="/usr/local/share/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
```

## Build Reproducibility

### Dependencies

- Uses `npm ci` for deterministic dependency installation
- Dependencies are locked in `package-lock.json`
- Package manager is pinned to npm@10.8.2

### Environment

- Required Node.js version is explicitly defined in `.config/.nvmrc`
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
node --version  # Should be v22.x.x

# Run full build verification
npm run ci:verify

# Run comprehensive checks
npm run dx:check
```

## CI/CD Integration

The repeatable build setup is integrated into CI/CD pipelines through:

- `.github/workflows/` configurations
- Container-based builds with pinned Node.js versions
- Deterministic dependency installation
- Build artifact verification
