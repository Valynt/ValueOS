# Launch Readiness

**Last updated:** 2026-03-17
**Maintained by:** Engineering — update blockers as they are resolved; move resolved items to the Resolved section with a PR reference.

---

## Scope

- Supporting checklist: [Release Readiness SWAT Team Checklist](./release-readiness-swat-checklist.md)
- **App / version:** ValueOS — ValyntApp + backend API
- **Target environment:** cloud-dev (Gitpod/Ona + hosted Supabase)
- **Required user flows:** login, opportunity creation, hypothesis generation, business case view
- **Out of scope for this launch:** VOSAcademy, mcp-dashboard, local Docker Compose path

---

## Blockers

These must be resolved before launch. Each is a true boot or critical-path failure.

~~- [ ] `TCT_SECRET` and `WEB_SCRAPER_ENCRYPTION_KEY` are required at backend startup but not mentioned in the README quickstart or validated in `validateEnv.ts` — a new engineer will hit a silent crash with no actionable message.~~ ✅ Resolved — see Resolved section.

~~- [ ] `SUPABASE_KEY` (alias for `SUPABASE_ANON_KEY`) is read by three backend files but is not listed as a required var anywhere visible to a new engineer — backend crashes at startup with `supabaseKey is required`.~~ ✅ Resolved — see Resolved section.

~~- [ ] `scripts/dx/doctor.js` crashes with `printToolVersions is not defined` — the preflight check exits non-zero before completing any checks.~~ ✅ Resolved — see Resolved section.

---

## Launch-safe known issues

These are real issues but do not block launch. Track and fix post-launch.

- [ ] `docs/environments/local-development.md` describes a Docker Compose stack that is not the primary dev target — confusing for new engineers but not a boot blocker.
- [ ] Root `.env.example` and `.env.local.example` still exist at repo root — demoted with header comments but could still mislead engineers who don't read the comments.
- [ ] `scripts/` directory contains ~150 scripts with no index or README — tribal knowledge required to find the right script.
- [ ] README Key Commands table previously listed `pnpm run db:push` (non-existent) — now fixed, but other commands in the table have not been verified from a clean environment.

---

## Post-launch work

Freeze until after launch.

- [ ] Migrate `MemorySystem` from in-process store to pgvector
- [ ] Replace `UnifiedAgentOrchestrator` references in any remaining docs
- [ ] Mass `any` type cleanup across unrelated modules
- [ ] Rewrite `scripts/dx/doctor.js` with full preflight coverage

---

## Commands

All commands verified to exist in root `package.json`:

| Purpose | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Start frontend + backend | `pnpm run dev` |
| Start backend only | `pnpm run dev:backend` |
| Start frontend only | `pnpm run dev:frontend` |
| Run unit tests | `pnpm test` |
| Run RLS security tests | `pnpm run test:rls` |
| Build for production | `pnpm run build` |
| Apply database migrations | `pnpm run db:migrate` |
| Run preflight env checks | `pnpm run dx:check` |
| TypeScript typecheck | `pnpm run check` |
| Lint | `pnpm run lint` |

---

## Environment variables

Full reference: [ops/env/README.md](../ops/env/README.md)

### cloud-dev (primary)

| Variable | Required | Source |
|---|---|---|
| `SUPABASE_URL` | ✅ required | Supabase dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | ✅ required | Supabase dashboard → Project Settings → API |
| `SUPABASE_KEY` | ✅ required | Same value as `SUPABASE_ANON_KEY` (alias) |
| `SUPABASE_PROJECT_REF` | ✅ required | Supabase dashboard → Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ required (backend) | Supabase dashboard → Project Settings → API |
| `DATABASE_URL` | ✅ required (backend) | Supabase dashboard → Project Settings → Database |
| `TCT_SECRET` | ✅ required (backend) | Generate: `openssl rand -hex 32` |
| `WEB_SCRAPER_ENCRYPTION_KEY` | ✅ required (backend) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | optional | App degrades gracefully when absent |
| `TOGETHER_API_KEY` | optional | Required for LLM agent features |

---

## Smoke test

Run after each deploy to confirm the system is healthy.

- [ ] `GET /health` returns `200 OK` with `{"status":"ok"}` — confirms backend is up and DB connection is live
- [ ] Frontend loads at the app URL without a blank screen or JS error in the console
- [ ] Login flow completes: enter credentials → redirect to dashboard → user name visible in nav
- [ ] Opportunity creation: create a new opportunity → it appears in the list
- [ ] Hypothesis generation: trigger agent on an opportunity → response appears within 30s
- [ ] `GET /health/secrets/public` returns `200` — confirms secret hydration succeeded

---

## Resolved

| Item | Resolved in |
|---|---|
| `pnpm run db:push` in README (script does not exist) | PR #1753 |
| README quickstart pointed to root `.env.example` instead of `ops/env/` | PR #1753 |
| `pnpm run dx:check` not available as a script | PR #1753 |
| `TCT_SECRET` missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `WEB_SCRAPER_ENCRYPTION_KEY` missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `SUPABASE_KEY` alias missing from `validateEnv.ts` `REQUIRED_VARS` — silent crash at startup | PR #1755 |
| `scripts/dx/doctor.js` crashes with `printToolVersions is not defined` | PR #1755 |
