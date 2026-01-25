# VOS Academy

Documentation for running and contributing to the Vite + React TypeScript app.

## Setup

- Install **Node.js 20+** and enable **Corepack**.
- Install dependencies from the repo root:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

## Development scripts

Run these from the repo root:

| Command | Purpose |
| --- | --- |
| `pnpm --filter vosacademy dev` | Start the Vite dev server with hot reloading. |
| `pnpm --filter vosacademy build` | Type-check and build the production bundle. |
| `pnpm --filter vosacademy preview` | Serve the built app locally to verify the production output. |
| `pnpm --filter vosacademy test` | Run the unit test suite with Vitest. |

## Environment variables

Copy `.env.example` to `.env.local`, then fill in the values. Alternatively, export variables in your shell before running commands. Relevant keys:

| Variable | Description |
| --- | --- |
| `VITE_OAUTH_PORTAL_URL` | Base URL for the OAuth portal used to generate login links. |
| `VITE_APP_ID` | Application identifier passed to the OAuth portal. |
| `DATABASE_URL` | Connection string for Postgres used by server-side data utilities and seed scripts. In production, include `sslmode=require` or `sslrootcert=/path/to/ca.pem` to enable TLS. |
| `OWNER_OPENID` | Owner OpenID value used by backend utilities. |
| `NODE_ENV` | Environment mode; defaults to `development` if not set. |

### Secrets and credential handling

- Do not commit real secrets or production credentials. The `.env.example` file documents required keys with safe placeholders.
- Store real values outside of version control (for example, through deployment-time environment variables or a secrets manager).
- Rotate and revoke any credentials that are accidentally exposed in a working copy or build log.

## How to run the app

1. Configure environment variables.
2. Start the dev server:
   ```bash
   pnpm --filter vosacademy dev
   ```
3. Open the URL printed by Vite (default `http://localhost:5173`).

To preview the production build locally after building:

```bash
pnpm --filter vosacademy build
pnpm --filter vosacademy preview
```

## Tests, linting, and builds

- **Tests:** `pnpm --filter vosacademy test`
- **Lockfile lint:** `pnpm --filter vosacademy lint:lockfile`
- **Lint:** Run ESLint directly (a script is not yet defined):
  ```bash
  pnpm --filter vosacademy exec eslint .
  ```
- **Build:** `pnpm --filter vosacademy build`
