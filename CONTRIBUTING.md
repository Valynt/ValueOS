# Contributing to ValueOS

This guide describes how to contribute safely and consistently across ValueOS.

## Quick links

- [Code standards](docs/engineering/code-standards.md)
- [CI/CD pipeline guide](docs/operations/ci-cd-pipeline.md)
- [Runbooks index](docs/runbooks/README.md)
- [ADR index](docs/engineering/adr-index.md)

## Local development setup

There are two canonical runtimes. Start them from the repo root:

```sh
pnpm install

# Start both together
pnpm run dev

# Or start independently
pnpm run dev:frontend   # apps/ValyntApp — React + Vite
pnpm run dev:backend    # packages/backend — Express API
```

All new product logic goes to one of these two runtimes. No other entry points exist.

## Deterministic dev environment invariants

- **Single authoritative compose file:** use only `docker-compose.yml` at repo root as the base (no `compose.yml`).
- **Dev override layer:** keep all devcontainer-specific config in `compose.devcontainer.override.yml`.
- **No cached VS Code pollution:** clear VS Code Dev Containers cache after major Compose/devcontainer changes.
- **No bind-mounted build artifacts:** never commit or mount host `node_modules`; use Docker volumes.
- **WSL-safe, Codespaces-safe, CI-safe:** changes must work across all supported environments.
- **No `COMPOSE_FILE` env injection:** do not set `COMPOSE_FILE` in shell or `.env`.

Helpful scripts:

```sh
./reset-dev-env.sh
./guard-node-modules.sh
```

## Branching strategy

- Branch from `main` for all work.
- Use short-lived branches and rebase/merge frequently from `main`.
- Naming convention:
  - `feat/<ticket-or-scope>`
  - `fix/<ticket-or-scope>`
  - `chore/<ticket-or-scope>`
  - `docs/<ticket-or-scope>`
  - `hotfix/<ticket-or-scope>` for urgent production remediation
- Keep PR scope focused: one concern per branch.
- For risky multi-phase work, prefer stacked PRs behind feature flags.

## Commit standards

- Make atomic commits with clear intent and minimal unrelated changes.
- Commit message format:
  - `type(scope): summary`
  - Example: `feat(api): add workspace membership guard`
- Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `revert`.
- Reference ticket IDs when available.
- Do not include secrets, credentials, or generated local artifacts in commits.

## Pull request standards

Each PR should include:

- **Problem statement** and **proposed solution**.
- **Impact/risk summary** (runtime, migration, security, operational).
- **Test evidence** (commands run and outcomes).
- **Screenshots or recordings** for UI changes.
- **Rollback approach** for production-impacting changes, with runbook link when possible.
- **ADR reference** when changing architecture boundaries or core patterns.
- **ADR index integrity**: if a PR adds, removes, renames, or updates an ADR in `docs/engineering/adr/`, update `docs/engineering/adr-index.md` in the same PR with accurate status/date/area metadata.

PR size guideline:

- Prefer < 500 changed lines (excluding generated files/tests) when practical.
- Split larger work into reviewable increments.

## Required local checks before opening a PR

Run these locally from repo root before requesting review:

```sh
pnpm run lint
pnpm run check
pnpm test
```

`pnpm test` is the canonical repo-wide Vitest workspace run from the root `vitest.config.ts`. Use that root command for full maintained-suite coverage; package-local test commands are for intentionally scoped runs only.

If your change touches data access, authz, or RLS policies, also run:

```sh
pnpm run test:rls
```

If your change touches UI or user journeys, also run:

```sh
pnpm run test:smoke
```

If your area has additional checks documented in service-level docs/runbooks, run those too.

## Architecture boundaries and change control

- Read the [ADR index](docs/engineering/adr-index.md) before modifying cross-cutting patterns.
- Align implementation with architecture docs in `docs/architecture/` and engineering standards.
- Do not introduce new service boundaries, persistence patterns, or event contracts without documented rationale.
- Any material architectural change must include either:
  - a new ADR, or
  - an update to an existing ADR + explicit approval in PR discussion.
- **Docs consistency checklist (required):** when runtime boundaries, canonical agent/runtime inventories, or ownership paths change, update all canonical docs in the same PR (`README.md`, `AGENTS.md`, relevant `docs/architecture/*`, and infra docs that reference paths/names).
- Keep layering clear:
  - UI concerns stay in frontend layers.
  - Business logic remains in domain/service layers.
  - Infrastructure integration remains isolated behind adapters/interfaces.

## Security review expectations

All contributors are responsible for baseline security review.

Minimum expectations:

- Validate authn/authz behavior for new/changed endpoints.
- Confirm least-privilege access and workspace/tenant isolation.
- Avoid logging sensitive data; redact where required.
- Review dependency and supply-chain impact for newly added packages.
- For schema/policy changes, verify RLS behavior with tests.
- For incident-relevant changes, ensure runbooks remain accurate.

Escalate for dedicated security review when a change includes:

- Auth/session/token handling changes.
- Cryptography or key-management changes.
- Multi-tenant data-path or RLS model changes.
- External integration handling regulated or sensitive data.

## Role-specific onboarding (first week)

### Frontend contributors

**Setup (day 1-2)**

- Complete environment setup from engineering docs.
- Run app locally and verify primary UI renders.
- Read code standards and frontend architecture docs.

**Validation checklist (by end of week 1)**

- [ ] `pnpm run lint` passes.
- [ ] `pnpm run check` passes (TypeScript).
- [ ] `pnpm run test` passes for touched packages.
- [ ] `pnpm run test:smoke` completed for impacted flows.
- [ ] Submitted one PR with screenshots and test evidence.

### Backend contributors

**Setup (day 1-2)**

- Complete environment setup and start dependent services.
- Validate API health and local DB connectivity.
- Read API/data architecture docs and code standards.

**Validation checklist (by end of week 1)**

- [ ] `pnpm run lint` passes.
- [ ] `pnpm run check` passes (TypeScript).
- [ ] `pnpm run test` passes for touched packages.
- [ ] `pnpm run test:rls` passes for policy-sensitive changes.
- [ ] Submitted one PR including API contract and risk notes.

### Infrastructure contributors

**Setup (day 1-2)**

- Review CI/CD guide and deployment/disaster-recovery runbooks.
- Validate access to required tooling and non-prod environments.
- Read infrastructure architecture and relevant ADRs.

**Validation checklist (by end of week 1)**

- [ ] Executed documented infra validation steps for your area.
- [ ] Verified pipeline behavior in a non-prod-safe path.
- [ ] Updated runbook references for any process/tooling drift.
- [ ] Submitted one PR with rollback steps and operational impact notes.

### Security contributors

**Setup (day 1-2)**

- Review security architecture and incident/emergency runbooks.
- Review CI/CD compliance evidence expectations.
- Confirm access to scanning/reporting tools used by the team.

**Validation checklist (by end of week 1)**

- [ ] Reviewed one recent PR for security posture and evidence quality.
- [ ] Verified at least one authz/RLS test workflow end-to-end.
- [ ] Confirmed incident-response escalation paths and evidence retention expectations.
- [ ] Submitted one PR improving a security control, test, or documentation gap.

## Contributor definition of done

A change is done only when all items below are true:

- Scope is complete and matches acceptance intent.
- Code and documentation are updated together.
- Required local checks completed and CI gates pass (`lint`, `check`, `test`, `build`, plus applicable `test:rls`/`test:smoke`).
- PR includes clear test evidence and risk assessment.
- Security review expectations were met for the change type.
- Architecture impact is documented (ADR reference/update when required).
- Operational impact is documented (runbook updates if behavior changed).
- Compliance evidence is traceable:
  - CI results linked to commit SHA/workflow run.
  - Relevant artifacts retained (`test-results/`, `playwright-report/`) when produced.
  - Exceptions/deviations explicitly documented and approved.

## Additional references

- Engineering docs index: [docs/engineering/README.md](docs/engineering/README.md)
- Architecture docs index: [docs/architecture/README.md](docs/architecture/README.md)
- Operations docs: [docs/operations/](docs/operations/)
