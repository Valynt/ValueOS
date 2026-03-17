## Context

ValueOS has three partially-overlapping setup paths that have accumulated over time:

1. **Root README quickstart** — references `cp .env.example .env.local`, `pnpm run db:push` (script does not exist), and `pnpm run dev`. Describes a local Docker Compose topology.
2. **`docs/environments/local-development.md`** — describes a devcontainer + Docker Compose multi-container stack with Supabase running locally. Accurate for that topology but not the primary dev target.
3. **Gitpod/Ona cloud-dev path** — the actual working path: `ops/env/` three-file system, `gitpod automations service start`, `pnpm run db:migrate`. Documented in `ops/env/README.md` but not surfaced in the root README.

The cloud-dev path is the one that works in this repo's intended environment. The other two paths are either broken (wrong script name) or require infrastructure (local Docker, local Supabase) that is not present in the devcontainer.

This change is documentation-only. No code, no schema, no dependencies change.

## Goals / Non-Goals

**Goals:**
- Root README quickstart reflects the cloud-dev path exactly
- Every command in the README exists and works
- `docs/launch-readiness.md` exists with a classified issue list
- `ops/env/README.md` is the single linked source of truth for env setup
- A new engineer can reach a running app by following the README with no prior knowledge

**Non-Goals:**
- Fixing the local Docker Compose path (valid alternative, not the primary target)
- Changing any application code, scripts, or env validation logic
- Resolving all launch blockers (this change identifies them; separate changes fix them)
- Automating the setup sequence

## Decisions

### Decision: Cloud-dev as the primary documented path

**Chosen:** Document cloud-dev (Gitpod/Ona + hosted Supabase) as the primary path.

**Alternatives considered:**
- Local Docker Compose: requires Docker Desktop or equivalent, adds ~5 min to first boot, and the devcontainer already assumes a cloud-dev topology. Not wrong, but not the default.
- Bare-metal local: no container, no Supabase local — requires the most manual setup and is the least reproducible.

**Rationale:** The devcontainer and automations are already wired for cloud-dev. It is the path that works today without additional infrastructure.

### Decision: Root `.env.example` demoted, not deleted

**Chosen:** Keep root `.env.example` and `.env.local.example` but add a header comment clarifying they are for the local Docker Compose path, not the primary cloud-dev path.

**Alternatives considered:**
- Delete them: breaks anyone using the local Docker path; too aggressive for a documentation change.
- Leave them as-is: perpetuates the confusion that they are the primary setup files.

**Rationale:** Demoting with a comment preserves the alternative path while removing the ambiguity.

### Decision: `docs/launch-readiness.md` as a new file, not an update to existing docs

**Chosen:** Create `docs/launch-readiness.md` as a standalone triage document.

**Alternatives considered:**
- Update `docs/environments/local-development.md`: wrong scope — that file is about environment setup, not launch classification.
- Update README: too much content for the README; launch readiness is a living document that will change frequently.

**Rationale:** A dedicated file can be updated independently as blockers are resolved without touching the README or environment docs.

## Risks / Trade-offs

- **[Risk] README rewrite diverges from reality again** → Mitigation: the smoke test in `docs/launch-readiness.md` includes a "fresh clone test" step that should be run before any README change is merged.
- **[Risk] Local Docker path users are confused by the demotion** → Mitigation: the demotion comment in `.env.example` links to `docs/environments/local-development.md` where the full local path is documented.
- **[Risk] `docs/launch-readiness.md` becomes stale** → Mitigation: blockers are linked to GitHub issues; resolved items are moved to a Resolved section with PR references, making staleness visible.

## Migration Plan

1. Update root README quickstart section
2. Add demotion header to `.env.example` and `.env.local.example`
3. Create `docs/launch-readiness.md` with current known state
4. Link `ops/env/README.md` from root README
5. Verify: fresh clone test in cloud-dev environment following the updated README

No rollback needed — documentation changes are reversible by revert.

## Open Questions

- Should `pnpm run db:push` be added as a script alias for `db:migrate` to avoid breaking muscle memory, or left absent to force correct usage? (Lean: leave absent — aliases hide the canonical command.)
- Should `scripts/dx/doctor.js` be added as a `pnpm run dx:check` script for discoverability? (Lean: yes — surface it in the README and package.json.)
