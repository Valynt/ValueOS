# Supabase service-role audit

Audit date: 2026-03-19.

This inventory classifies every current `createServerSupabaseClient()` call under `packages/backend/src` and records the request-path call sites that were remediated in this change.

## Allowed background / provisioning / admin use

### Platform bootstrap and internal infrastructure
- `packages/backend/src/server.ts:627` — server bootstrap wiring for internal runtime initialization.
- `packages/backend/src/lib/supabase.ts:53` — singleton implementation of the service-role client itself.
- `packages/backend/src/runtime/execution-runtime/DecisionContextRepository.ts:41` — internal runtime persistence.
- `packages/backend/src/runtime/execution-runtime/index.ts:155` — internal execution runtime wiring.
- `packages/backend/src/lib/rules.ts:245` and `:334` — internal policy/rule evaluation support.
- `packages/backend/src/lib/memory/SupabaseVectorStore.ts:80` and `packages/backend/src/lib/memory/SupabaseSemanticStore.ts:70` — backend memory persistence.

### Background workers and async job processors
- `packages/backend/src/workers/CertificateGenerationWorker.ts:151`.
- `packages/backend/src/workers/billingAggregatorWorker.ts:8`.
- `packages/backend/src/workers/ArtifactGenerationWorker.ts:66`.
- `packages/backend/src/services/billing/UsagePersistenceService.ts:18`.
- `packages/backend/src/services/certificates/CertificateJobRepository.ts:162`.
- `packages/backend/src/services/artifacts/ArtifactJobRepository.ts:57`, `:109`, `:141`, `:199`.
- `packages/backend/src/services/crm/TokenReEncryptionJob.ts:56`.

### Auth/admin/security flows
- `packages/backend/src/api/auth.ts:38` — admin-auth adapter bootstrap.
- `packages/backend/src/services/auth/AuthDirectoryService.ts:20`.
- `packages/backend/src/services/auth/consentRegistry.ts:15`.
- `packages/backend/src/services/auth/UserProfileDirectoryService.ts:20`.
- `packages/backend/src/services/auth/AdminRoleService.ts:64`.
- `packages/backend/src/services/auth/AdminUserService.ts:79`.
- `packages/backend/src/config/secretsManager.ts:177`, `:241`, `:308`.
- `packages/backend/src/config/secrets/SecretAuditLogger.ts:74`.
- `packages/backend/src/services/security/AuditLogService.ts:108`.
- `packages/backend/src/services/security/ComplianceControlCheckService.ts:48`.
- `packages/backend/src/services/security/SecurityAnomalyService.ts:81`.
- `packages/backend/src/services/security/ComplianceControlStatusService.ts:53`.
- `packages/backend/src/services/post-v1/SecurityAuditService.ts:64`.
- `packages/backend/src/api/health/index.ts:806` — health diagnostics.

### Tenant provisioning / archival / elevated tenant maintenance
- `packages/backend/src/services/tenant/TenantProvisioningEmail.ts:42`, `:76`.
- `packages/backend/src/services/tenant/TenantUsageProvisioning.ts:21`.
- `packages/backend/src/services/tenant/TenantBillingProvisioning.ts:22`.
- `packages/backend/src/services/tenant/TenantArchivalService.ts:37`, `:264`, `:404`.
- `packages/backend/src/services/tenant/TenantOrganizationProvisioning.ts:10`, `:71`.
- `packages/backend/src/services/tenant/TenantContextIngestionService.ts:128`, `:167`.
- `packages/backend/src/services/tenant/TenantDeletionService.ts:89`.

### Dedicated elevated services with narrow API surface and audit logging
- `packages/backend/src/services/privacy/DataSubjectRequestAdminService.ts:26` — centralized DSR export/erase/status service with explicit audit writes.
- `packages/backend/src/services/customer/CustomerValueCaseReadService.ts:47` — customer-token portal read service isolated away from the route handler.
- `packages/backend/src/api/services/ReferralAnalyticsService.ts:63`.
- `packages/backend/src/api/services/ReferralService.ts:26`.

### Internal repositories still using service-role by allowlist
- `packages/backend/src/repositories/SupabaseProvenanceStore.ts:25`, `:48`, `:66`, `:86`.
- `packages/backend/src/repositories/RoiModelRepository.ts:12`.
- `packages/backend/src/repositories/ValueCommitRepository.ts:12`.
- `packages/backend/src/repositories/ValueTreeLinkRepository.ts:12`.
- `packages/backend/src/repositories/KpiTargetRepository.ts:12`.
- `packages/backend/src/repositories/NarrativeDraftRepository.ts:50`.
- `packages/backend/src/repositories/WorkflowStateRepository.ts:58`.
- `packages/backend/src/repositories/ExpansionOpportunityRepository.ts:85`.
- `packages/backend/src/repositories/RealizationReportRepository.ts:70`.
- `packages/backend/src/repositories/ValueTreeNodeRepository.ts:12`.
- `packages/backend/src/repositories/IntegrityResultRepository.ts:60`.
- `packages/backend/src/repositories/RoiModelCalculationRepository.ts:12`.

### Analytics, exports, CRM, agent fabric, and other non-request internal services
- `packages/backend/src/analytics/ValueLoopAnalytics.ts:89`, `:168`.
- `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts:130`, `:531`.
- `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts:218`.
- `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts:125`, `:595`.
- `packages/backend/src/services/crm/ValueCaseScaffolder.ts:19`.
- `packages/backend/src/services/crm/CrmHealthService.ts:41`.
- `packages/backend/src/services/crm/CrmConnectionService.ts:31`.
- `packages/backend/src/services/crm/CrmWebhookService.ts:64`.
- `packages/backend/src/services/crm/IntegrationControlService.ts:52`, `:77`, `:121`.
- `packages/backend/src/services/crm/AgentPrefetchService.ts:65`.
- `packages/backend/src/services/crm/CrmSyncService.ts:90`.
- `packages/backend/src/services/deal/CRMConnector.ts:393`.
- `packages/backend/src/services/export/PptxExportService.ts:117`.
- `packages/backend/src/services/export/PdfExportService.ts:58`.
- `packages/backend/src/services/post-v1/AgentFabricService.ts:61`.
- `packages/backend/src/services/post-v1/EmailAnalysisService.ts:11`.
- `packages/backend/src/services/post-v1/OfflineEvaluation.ts:68`.
- `packages/backend/src/services/post-v1/EventSourcingService.ts:55`.
- `packages/backend/src/services/ground-truth/ChunkEmbedPipeline.ts:208`.

### Test-only occurrences
- `packages/backend/src/lib/__tests__/testRuntimeGuards.test.ts:19`.
- `packages/backend/src/lib/agent-fabric/__tests__/SupabaseMemoryBackend.integration.test.ts:66`.

## Forbidden request-path / data-access uses remediated in this change

These call sites were previously request-path or repository fallbacks and were removed or converted:
- `packages/backend/src/api/valueCases/repository.ts` — removed service-role constructor fallback; callers must pass a request/user-scoped client.
- `packages/backend/src/api/valueDrivers/repository.ts` — removed service-role constructor fallback; route handlers now call `ValueDriversRepository.fromRequest(req)`.
- `packages/backend/src/api/artifacts/repository.ts` — removed service-role constructor fallback.
- `packages/backend/src/api/conversations/repository.ts` — removed service-role constructor fallback.
- `packages/backend/src/api/artifacts.ts` — case verification and permission checks now use `req.supabase`.
- `packages/backend/src/api/dealAssembly.ts` — ownership check now uses `req.supabase`.
- `packages/backend/src/api/valueCases/backHalf.ts` — provenance lookups and orchestrator runs now inject `req.supabase` instead of constructing service-role clients in the route file.
- `packages/backend/src/middleware/rbac.ts` — exported `checkPermission(...)` now requires a caller-supplied client.
- `packages/backend/src/middleware/planEnforcementMiddleware.ts` — organization plan lookups now use request-scoped Supabase.
- `packages/backend/src/middleware/authorization.middleware.ts` — customer entitlement lookups now use request-scoped Supabase.
- `packages/backend/src/api/dataSubjectRequests.ts` — elevated reads/writes moved behind `DataSubjectRequestAdminService`.
- `packages/backend/src/api/customer/value-case.ts` — elevated customer-token reads moved behind `CustomerValueCaseReadService`.

## Guardrail outcome

The backend ESLint boundary override now blocks importing `createServerSupabaseClient`, `getSupabaseClient`, or `supabase` from request handlers, middleware, and repositories unless the file is explicitly allowlisted in `backendModuleBoundaryOverrides.ignores`.
## Current policy (effective 2026-03-26)

- General-purpose imports from `packages/backend/src/lib/supabase.ts` must not be used for new service-role access.
- Use privileged modules only:
  - `packages/backend/src/lib/supabase/privileged/authProvisioning.ts`
  - `packages/backend/src/lib/supabase/privileged/cron.ts`
  - `packages/backend/src/lib/supabase/privileged/platformAdmin.ts`
- Service-role call sites are allowed only in:
  - `packages/backend/src/services/auth/`
  - `packages/backend/src/services/tenant/`
  - `packages/backend/src/workers/`
  - `packages/backend/src/jobs/`
  - `scripts/jobs/`
- Every call site must include `justification: "service-role:justified <reason>"`.
- CI guard: `pnpm check:backend-service-role-boundaries`.
