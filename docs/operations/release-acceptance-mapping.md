# Release Acceptance Mapping — Story to Evidence

_Last updated: 2026-03-12_

This matrix maps each release-scoped story to concrete implementation evidence across backend endpoint, frontend hook, UI surface, and tests/checks.

| Story | Endpoint evidence | Hook/client evidence | UI evidence | Test/check evidence |
|---|---|---|---|---|
| US-001 — Create value case from CRM opportunity prefill | `CRMIntegrationService.fetchDeals()` now requires a real CRM connection and no longer returns mock Acme fallback payloads. | Dashboard uses `useCreateCase()` for case creation flow; CRM list/sync now reflects production-only behavior from backend integration service. | Dashboard quick-start and opportunity flows remain the case creation entry points for release scope. | `packages/backend/src/services/__tests__/CRMIntegrationService.test.ts` verifies no mock deals when disconnected and real sync path when connected. |
| US-007 — Tenant onboarding context | `POST /api/v1/tenant/context` remains planned in sprint docs, not in GA must-have scope. | N/A (deferred) | N/A (deferred) | Deferred tracking in user story status + sprint plan docs. |
| US-008 — CRM integration depth | HubSpot is active production path; Salesforce and additional adapters are deferred. | Existing CRM integration path retained; no mock fallback for HubSpot deals. | Integrations dashboard continues to show connection health. | CRM integration unit tests and release scope classification (must-have vs deferred). |
| US-009 — Tenant isolation | Tenant-scoped queries and RLS posture remain release blockers. | Existing tenant-aware client hooks unchanged. | No UI delta; enforced at platform layer. | `tenant-isolation-gate` in `.github/workflows/pr-fast.yml` runs live Supabase RLS checks on non-fork PRs (`node scripts/ci/run-tenant-isolation-rls-suite.mjs`) and static-only checks on fork PRs; the script fails when executed tests fall below `RLS_MIN_EXECUTED_TESTS` (default 10). |
| US-010 — Audit trail | Audit logging and append-only `agent_audit_log` posture retained; stubs previously resolved. | Existing services/hook flows unchanged. | Audit Trail dashboard and compliance views unchanged. | Existing audit and service tests plus debt/user-story status evidence. |

## Scope decision summary

- **Must-have for this release:** US-001 (CRM prefill production path), US-009, US-010.
- **Deferred:** US-007, and deferred portions of US-008 (Salesforce + ServiceNow/Slack/SharePoint).
