# ValueCanvas

ValueCanvas is a multi-tenant AI workflow platform that combines a Vite/React front end, a Supabase-backed data layer, and agent services that orchestrate long-running workflows. The platform runs across a small set of composable services so teams can ship features quickly while keeping security controls (RLS, audit logging, and secrets hygiene) in place from day one.

## System context
- **Clients** use the React UI and call the backend over HTTPS.
- **API & Orchestrator** handle billing, routing, and agent workflow coordination for each tenant.
- **Supabase** provides Postgres (with RLS), storage, and edge functions for LLM proxying.
- **Background services** (Redis, observability stack) support caching, rate limiting, and telemetry.
- **Secrets manager** (AWS Secrets Manager or Vault) stores operational credentials; environment files are reserved for non-sensitive defaults.

## Service map
| Layer | What runs here | Key responsibilities |
| --- | --- | --- |
| Frontend | `vite` React app (see `src/`) | UI, session handling, client-side Supabase auth |
| API & Billing | Express server (`src/backend/server.ts`) | Billing routes, webhook handling, tenant-aware CORS |
| Agent Fabric | Orchestrator and agents (`src/lib`, `src/services`) | Workflow execution, tenant-aware rules, tool access |
| Data plane | Supabase Postgres, storage, Redis (`supabase/`, `infrastructure/`) | RLS policies, audit logging, caching |
| CI/CD & Security | GitHub Actions workflows | Lint/typecheck/tests, secret scanning, SBOM, container scanning, builds |

## Environment setup
1. **Prerequisites**: Node 20+, npm, Docker (for Supabase/local db), and the Supabase CLI (`supabase/setup-cli@v1` in CI).
2. **Install dependencies**: `npm ci`
3. **Secrets**: set `SECRETS_MANAGER_ENABLED=true` with `SECRETS_PROVIDER=aws` or `vault` and provide cloud credentials. Required keys (e.g., `SUPABASE_SERVICE_KEY`, `REDIS_URL`) are loaded from the secrets manager; `.env` should not contain production secrets.
4. **Database**: `npm run db:setup` to bootstrap Supabase locally. Regenerate types with `npm run db:types`.
5. **Run locally**: `npm run dev` (frontend) and `npm run backend:dev` (billing API).

## Testing
- Unit & integration: `npm test`
- Type checking: `npm run typecheck`
- RLS & multi-tenant policies: `npm run test:rls` (runs Supabase SQL suites in `supabase/tests/database`)
- Security scans: `npm run security:scan` and `npm run security:scan:snyk` (requires `SNYK_TOKEN`)

See [TESTING.md](TESTING.md) for detailed scenarios and coverage notes.

## Contributing
Pull requests follow the standard fork-and-branch flow. See [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards, commit hygiene, and review expectations.

## CI/CD and supply chain controls
A dedicated GitHub Actions pipeline enforces lint → typecheck → unit/integration → RLS/multi-tenant → dependency audit/Snyk → SBOM/Trivy → build. Secret scanning (git-secrets + TruffleHog) runs before any build artifacts are produced, and SBOM plus image scanning gate deployments. See `.github/workflows/secure-ci.yml` for details.
# Project Environments

## Development Environment (Dev Container)

```bash
# Open in VS Code with Dev Containers extension
code .
# Then: Reopen in Container
```

## Staging Environment

```bash
# Build and start
docker-compose -f docker/stage/docker-compose.yml up -d --build

# View logs
docker-compose -f docker/stage/docker-compose.yml logs -f

# Stop
docker-compose -f docker/stage/docker-compose.yml down
```

## Production Environment

```bash
# Deploy
./scripts/deploy.sh prod

# Health check
./scripts/health-check.sh prod 8000

# View logs
docker-compose -f docker/prod/docker-compose.yml logs -f app
```

## Environment Variables

Copy `.env.example` to `.env.dev`, `.env.stage`, and `.env.prod` and update values.

## Health Endpoints

- `/healthz` - Liveness probe
- `/ready` - Readiness probe

---

# Supabase CLI

[![Coverage Status](https://coveralls.io/repos/github/supabase/cli/badge.svg?branch=main)](https://coveralls.io/github/supabase/cli?branch=main) [![Bitbucket Pipelines](https://img.shields.io/bitbucket/pipelines/supabase-cli/setup-cli/master?style=flat-square&label=Bitbucket%20Canary)](https://bitbucket.org/supabase-cli/setup-cli/pipelines) [![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/sweatybridge%2Fsetup-cli?label=Gitlab%20Canary)
](https://gitlab.com/sweatybridge/setup-cli/-/pipelines)

[Supabase](https://supabase.io) is an open source Firebase alternative. We're building the features of Firebase using enterprise-grade open source tools.

This repository contains all the functionality for Supabase CLI.

- [x] Running Supabase locally
- [x] Managing database migrations
- [x] Creating and deploying Supabase Functions
- [x] Generating types directly from your database schema
- [x] Making authenticated HTTP requests to [Management API](https://supabase.com/docs/reference/api/introduction)

## Getting started

### Install the CLI

Available via [NPM](https://www.npmjs.com) as dev dependency. To install:

```bash
npm i supabase --save-dev
```

To install the beta release channel:

```bash
npm i supabase@beta --save-dev
```

When installing with yarn 4, you need to disable experimental fetch with the following nodejs config.

```
NODE_OPTIONS=--no-experimental-fetch yarn add supabase
```

> **Note**
For Bun versions below v1.0.17, you must add `supabase` as a [trusted dependency](https://bun.sh/guides/install/trusted) before running `bun add -D supabase`.

<details>
  <summary><b>macOS</b></summary>

  Available via [Homebrew](https://brew.sh). To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To install the beta release channel:
  
  ```sh
  brew install supabase/tap/supabase-beta
  brew link --overwrite supabase-beta
  ```
  
  To upgrade:

  ```sh
  brew upgrade supabase
  ```
</details>

<details>
  <summary><b>Windows</b></summary>

  Available via [Scoop](https://scoop.sh). To install:

  ```powershell
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```

  To upgrade:

  ```powershell
  scoop update supabase
  ```
</details>

<details>
  <summary><b>Linux</b></summary>

  Available via [Homebrew](https://brew.sh) and Linux packages.

  #### via Homebrew

  To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To upgrade:

  ```sh
  brew upgrade supabase
  ```

  #### via Linux packages

  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

  ```sh
  sudo apk add --allow-untrusted <...>.apk
  ```

  ```sh
  sudo dpkg -i <...>.deb
  ```

  ```sh
  sudo rpm -i <...>.rpm
  ```

  ```sh
  sudo pacman -U <...>.pkg.tar.zst
  ```
</details>

<details>
  <summary><b>Other Platforms</b></summary>

  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

  ```sh
  go install github.com/supabase/cli@latest
  ```

  Add a symlink to the binary in `$PATH` for easier access:

  ```sh
  ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase
  ```

  This works on other non-standard Linux distros.
</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
  To install in your working directory:

  ```bash
  pkgx install supabase
  ```

  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).
</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
