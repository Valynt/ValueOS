## 1. Add dx:check script

- [x] 1.1 Add `"dx:check": "node scripts/dx/doctor.js"` to root `package.json` scripts so the preflight check is discoverable via `pnpm run dx:check`

## 2. Fix README quickstart

- [x] 2.1 Replace the Quickstart section in `README.md` with the cloud-dev path: copy env files from `ops/env/`, fill credentials, run `pnpm install`, run `pnpm run db:migrate`, start services via `gitpod automations service start backend frontend`
- [x] 2.2 Remove `pnpm run db:push` from README — script does not exist; replace with `pnpm run db:migrate`
- [x] 2.3 Remove `cp .env.example .env.local` from README quickstart — this is the local Docker path, not cloud-dev
- [x] 2.4 Add `pnpm run dx:check` as a preflight verification step in the quickstart, after env setup and before starting services
- [x] 2.5 Link `ops/env/README.md` from the README env setup step as the full variable reference

## 3. Demote root env templates

- [x] 3.1 Add a header comment to `.env.example` clarifying it is for the local Docker Compose path, pointing to `ops/env/README.md` for the primary cloud-dev setup and to `docs/environments/local-development.md` for the full local Docker path
- [x] 3.2 Add the same header comment to `.env.local.example`

## 4. Create launch-readiness document

- [x] 4.1 Create `docs/launch-readiness.md` with sections: Scope, Blockers, Launch-safe known issues, Post-launch work, Commands, Environment variables, Smoke test
- [x] 4.2 Populate Blockers with known issues found during research: `pnpm run db:push` missing, README env path mismatch, `SUPABASE_KEY` alias not documented in README, `TCT_SECRET` and `WEB_SCRAPER_ENCRYPTION_KEY` not mentioned in quickstart
- [x] 4.3 Populate Commands section with verified commands: install, dev, test, build, migrate, deploy
- [x] 4.4 Populate Environment variables section from `ops/env/README.md` required vars by mode
- [x] 4.5 Populate Smoke test with: health endpoint returns 200, frontend loads, login flow completes, DB connection confirmed via health endpoint

## 5. Verify

- [x] 5.1 Perform a fresh clone test: follow the updated README exactly from a clean shell and confirm the app reaches a running state with no undocumented steps
- [x] 5.2 Confirm every `pnpm run <command>` in the README exists in `package.json`
- [x] 5.3 Run `pnpm run dx:check` after env setup and confirm it exits 0
- [x] 5.4 Run `bash scripts/validate-cloud-dev-env.sh` after env setup and confirm it exits 0
