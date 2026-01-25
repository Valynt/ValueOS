# ValueOS Quickstart Guide

Get up and running with ValueOS in under 10 minutes.

## Prerequisites

- **Node.js**: 20+ (use the version in `.nvmrc`)
- **Docker Desktop**: installed and running
- **Git**: for cloning the repository
- **Corepack**: for managing the pinned pnpm version

## Local Dev Quickstart (Default)

Follow these commands from a clean machine to a running app.

### 1. Clone the repository

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
```

**Expected outcome:** repo cloned and working directory set to `valueos`.

### 2. Install dependencies with the pinned pnpm version

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

**Expected outcome:** pnpm installs dependencies and creates `node_modules/`.

### 3. Generate local environment files

```bash
pnpm run dx:env -- --mode local --force
```

**Expected outcome:** `.env.local`, `.env.ports`, and `deploy/envs/.env.ports` are generated for local mode.

### 4. Start the full development stack

```bash
pnpm run dx
```

**Expected outcome:** Docker dependencies, Supabase, backend, and frontend start. You should see Vite report `http://localhost:5173`.

### 5. (Optional) Seed a demo user

```bash
pnpm run seed:demo
```

**Expected outcome:** demo user credentials are printed in the terminal.

## Access points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health
- **Supabase API**: http://localhost:54321
- **Supabase Studio**: http://localhost:54323

## Next steps

- [Local Development Setup](./local-setup.md) - detailed workflows and options
- [Environment Configuration](../ENVIRONMENT.md) - env file generation and modes
- [Troubleshooting](./troubleshooting.md) - common issues and fixes
