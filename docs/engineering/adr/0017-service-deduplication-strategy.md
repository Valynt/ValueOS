# ADR 0017: Service De-duplication Strategy

- **Status:** Accepted
- **Date:** 2026-07-15
- **Context:**
  - The ValueOS monorepo accumulated duplicate service implementations during rapid prototyping. The most visible cases were:
    - Two files named `ValueTreeService.ts` at different paths (`services/` and `services/value/`).
    - Three oversized service files (`CanvasSchemaService.ts` at 1818 lines, `TenantProvisioning.ts` at 1437 lines, `AgentRetryManager.ts` at 1389 lines) that mixed multiple concerns in a single class or module.
    - Legacy root directories (`client/`, `server/`, `shared/`) that duplicated code already in `apps/ValyntApp/` and `packages/`.
  - Without a documented strategy, the same pattern would recur: new contributors would add code to the nearest file rather than the canonical location.

- **Decision:**
  - **Verify before consolidating.** Before treating two files with the same name as duplicates, read both and confirm they serve the same purpose. If they are intentionally distinct (different concerns, different callers), document the distinction in each file's header comment and in `debt.md`. Do not consolidate.
  - **Canonical location rule.** Each concern has one canonical file. The canonical location is determined by the concern's domain:
    - Domain types and interfaces → `packages/shared/src/domain/` (Zod schemas) or a co-located `*Types.ts` file for implementation-specific types.
    - Tenant limits and feature flags → `services/tenant/TenantLimits.ts` (not inline in provisioning logic).
    - Pure transformation/action logic → extracted module (e.g., `CanvasActionApplier.ts`) imported by the orchestrating service.
    - Retry/resilience types → `*Types.ts` co-located with the implementation.
  - **Extraction over deletion.** When a file exceeds ~1000 lines, extract cohesive sub-concerns into separate files. The original file re-exports everything for backward compatibility. Callers do not need to update imports.
  - **Legacy directory removal.** Root-level directories that duplicate monorepo packages (`client/`, `server/`, `shared/`) are removed after migrating active code to the canonical package location. An ESLint `no-restricted-imports` rule is added to prevent re-introduction.
  - **Debt tracking.** Resolved de-duplication work is recorded in `.ona/context/debt.md` under the Resolved section with the date and a description of what was done.

- **Consequences:**
  - The `ValueTreeService` case (two intentionally distinct files) is documented and will not be incorrectly consolidated in future sprints.
  - Extracting `CanvasActionApplier`, `TenantLimits`, and `AgentRetryTypes` reduced the three largest files by 10–16% each while preserving all public APIs via re-exports.
  - The ESLint `legacyRootDirBan` rule prevents `client/`, `server/`, and `shared/` from being re-introduced.
  - The "verify before consolidating" rule adds a step to the pre-PR checklist in `memory.md`.
  - Files that are intentionally large (e.g., a single-class service with many methods that are tightly coupled to shared state) are not split just to hit a line-count target. The extraction criterion is cohesion, not size alone.
