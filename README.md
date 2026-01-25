# ValueOS

ValueOS is a multi-workspace platform for value modeling and lifecycle intelligence. This repository is a monorepo that currently ships the ValyntApp frontend along with shared packages.

## Setup

1. Install Node.js 20.x (or newer) and enable Corepack.
2. Run the automated setup (installs dependencies and generates env files):

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm run setup
```

3. If you prefer manual setup instead of the script:

```bash
pnpm install
pnpm run dx:env -- --mode local --force
```

## Running the app

Run the full local development stack (deps + backend + frontend):

```bash
pnpm run dx
```

Run the frontend only (if services are already running):

```bash
pnpm run dev
```

Run the backend only:

```bash
pnpm run backend:dev
```

## Common scripts

Run these from the repo root.

| Task | Command |
| --- | --- |
| Lint | `pnpm run lint` |
| Type-check | `pnpm run typecheck` |
| Tests (with coverage) | `pnpm run test` |
| Build | `pnpm run build` |
| Full CI verification | `pnpm run ci:verify` |

## Environment variables

See `.env.example` and `apps/ValyntApp/.env.example` for required values. Key variables include:

- `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_REDIRECT_URI` for OIDC auth.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for Supabase.
- `VITE_API_BASE_URL`, `VITE_APP_URL` for API routing.
- `VITE_TENANTS_API_ENABLED`, `VITE_BILLING_ENABLED` for feature flags.

## Secret handling

- Never commit `.env.local` or secrets to the repo.
- Use the templates in `deploy/envs/` for staging/production guidance.
- Store production secrets in your secret manager (GitHub Actions secrets, Vault, etc.).

## CI/CD

A lightweight CI workflow runs lint, type-check, test (with coverage thresholds), build, and dependency scans. Configure branch protection to require the CI workflow and coverage gate before merging.
