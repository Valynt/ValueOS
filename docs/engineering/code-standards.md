# Code Standards

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## ValueOS Contract

*Source: `CONTRACT.md`*

## Goal
Deliver a multi-workspace platform for value modeling and lifecycle intelligence that enables teams to model value, track lifecycle changes, and collaborate across shared workspaces with reliable data and predictable UX.

## Non-goals
- Building a standalone BI/analytics warehouse or replacing existing enterprise data platforms.
- Supporting offline-first usage or native mobile apps in this release.
- Providing custom per-tenant data pipelines beyond configured integrations.

## User stories
- As a workspace admin, I can create and manage workspaces so teams can collaborate on value models.
- As a modeler, I can define value models and lifecycle stages to capture business logic consistently.
- As a stakeholder, I can view dashboards and summaries of value outcomes to make decisions.
- As an operator, I can audit changes to value models to understand who changed what and when.

## Data model changes (if any)
- None required for this contract; changes must be explicitly listed when introduced.

## API surface (routes, payloads)
> Note: Only verify routes that are implemented. This contract is the checklist for future work.

- `GET /api/workspaces` → lists workspaces visible to the user.
- `POST /api/workspaces` → creates a workspace.
  - Payload: `{ name: string, description?: string }`
- `GET /api/workspaces/:workspaceId` → workspace details.
- `GET /api/models?workspaceId=` → list value models for a workspace.
- `POST /api/models` → create value model.
  - Payload: `{ workspaceId: string, name: string, description?: string }`
- `GET /api/models/:modelId` → value model details.
- `PATCH /api/models/:modelId` → update value model metadata.
  - Payload: `{ name?: string, description?: string, status?: string }`
- `GET /api/models/:modelId/changes` → audit log of model changes.

## UI states (happy path + empty + error)
- Workspaces
  - Happy: workspace list populated with name, description, and last updated.
  - Empty: clear empty state with CTA to create a workspace.
  - Error: error banner with retry option if workspace load fails.
- Value models
  - Happy: model list shows name, status, and last updated.
  - Empty: empty state explaining value models and CTA to create one.
  - Error: error banner with retry option if models fail to load.
- Model detail
  - Happy: model summary with lifecycle stages and audit log access.
  - Empty: prompts to add lifecycle stages if none exist.
  - Error: error banner and partial fallback if detail fetch fails.

## Acceptance criteria
- Users with access can list workspaces and models without errors in < 2s median response time.
- Unauthorized users cannot access workspaces or models outside their permissions (403 or 404).
- Create/update actions validate required fields and return user-friendly errors.
- Audit log records include actor, timestamp, action type, and target object.
- UI empty states provide a single primary CTA and link to documentation.

## Test plan (unit/integration/e2e)
- Unit: validation for workspace/model payloads and status transitions.
- Integration: API CRUD for workspaces/models and permission checks.
- E2E: workspace creation → model creation → view model detail → view audit log.

## Observability (logs/metrics/traces)
- Logs: structured logs for API requests, validation errors, and permission failures.
- Metrics: request latency (p50/p95), error rate, and create/update success counts.
- Traces: API routes for workspace and model CRUD to diagnose latency bottlenecks.

## Security constraints (authz, RLS, PII rules)
- Authz: all workspace/model routes require authenticated users with workspace membership.
- RLS: enforce row-level security for workspace-scoped data.
- PII: avoid storing sensitive user data in model payloads; redact user identifiers in logs where possible.

---

## Technical Debt Annotation Policy

The following **strict zones** require metadata on every `TODO`/`FIXME` comment:

- `packages/backend/src`
- `apps/ValyntApp/src/services`
- `infra/terraform`

Required format in strict zones:

- `TODO(ticket:<id> owner:<team-or-user> date:YYYY-MM-DD): <action>`
- `FIXME(ticket:<id> owner:<team-or-user> date:YYYY-MM-DD): <action>`

Examples:

- `// TODO(ticket:VOS-1234 owner:platform-team date:2026-02-13): Replace stub repository with Supabase-backed implementation.`
- `# FIXME(ticket:OPS-987 owner:devops date:2026-02-13): Restrict overly broad IAM policy.`

Enforcement:

- `node scripts/debt/inventory.mjs` is CI-enforced and fails when strict-zone comments are malformed.
- The same check ratchets strict-zone TODO/FIXME counts against `config/debt-baseline.json` and fails CI on net-new growth.

Backlog triage guidance:

- Prefer resolving debt immediately when scope is small and safe.
- If deferring, annotate with required metadata and link an actionable ticket.
- Keep owners current and refresh stale dates when work is re-triaged.

