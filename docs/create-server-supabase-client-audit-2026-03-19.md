# `createServerSupabaseClient()` audit — March 19, 2026

Audit scope: every `createServerSupabaseClient()` call found under `packages/backend/src` at the start of this remediation.

## Forbidden request-path/data-access usage remediated in this change

| File | Call count | Classification | Action |
| --- | ---: | --- | --- |
| `packages/backend/src/api/valueCases/repository.ts` | 1 | Forbidden request-path repository fallback | Removed service-role fallback; callers must inject a request-scoped/user-scoped client. |
| `packages/backend/src/api/conversations/repository.ts` | 1 | Forbidden request-path repository fallback | Removed service-role fallback; callers must inject a request-scoped/user-scoped client. |
| `packages/backend/src/api/artifacts/repository.ts` | 1 | Forbidden request-path repository fallback | Removed service-role fallback; callers must inject a request-scoped/user-scoped client. |
| `packages/backend/src/api/valueDrivers/repository.ts` | 1 | Forbidden request-path repository fallback | Removed service-role fallback; routes now use `ValueDriversRepository.fromRequest(req)`. |
| `packages/backend/src/api/artifacts.ts` | 1 | Forbidden request-path ownership check | Replaced with `RequestScopedValueCaseAccessService` backed by `req.supabase`. |
| `packages/backend/src/api/dealAssembly.ts` | 1 | Forbidden request-path ownership check | Replaced with `RequestScopedValueCaseAccessService` backed by `req.supabase`. |
| `packages/backend/src/api/dataSubjectRequests.ts` | 3 | Forbidden request-path admin/DSR access | Replaced all three request handlers with `req.supabase`. |
| `packages/backend/src/middleware/planEnforcementMiddleware.ts` | 1 | Forbidden middleware read path | Replaced with `getRequestSupabaseClient(req)`. |
| `packages/backend/src/middleware/authorization.middleware.ts` | 1 | Forbidden middleware entitlement check | Replaced with `getRequestSupabaseClient(req)`. |
| `packages/backend/src/middleware/rbac.ts` | 1 | Forbidden exported request-path helper fallback | `checkPermission(...)` now requires a caller-supplied request/user-scoped client. |

## Allowed retained usage (background, provisioning, admin, security, or explicitly isolated infrastructure)

| File | Call count | Classification |
| --- | ---: | --- |
| `packages/backend/src/server.ts` | 1 | Allowed infrastructure/bootstrap use. |
| `packages/backend/src/api/auth.ts` | 1 | Allowed auth/admin use. |
| `packages/backend/src/api/customer/value-case.ts` | 1 | Allowed but isolated customer-portal service-role read path pending token-model migration. |
| `packages/backend/src/lib/rules.ts` | 2 | Allowed shared policy/rules infrastructure. |
| `packages/backend/src/api/health/index.ts` | 1 | Allowed health/diagnostics use. |
| `packages/backend/src/lib/supabase.ts` | 2 | Allowed client factory and lazy singleton implementation. |
| `packages/backend/src/api/services/ReferralService.ts` | 1 | Allowed service/admin workflow. |
| `packages/backend/src/api/services/ReferralAnalyticsService.ts` | 1 | Allowed analytics/background workflow. |
| `packages/backend/src/api/valueCases/backHalf.ts` | 2 | Allowed background/post-processing workflow. |
| `packages/backend/src/lib/memory/SupabaseSemanticStore.ts` | 1 | Allowed backend memory infrastructure. |
| `packages/backend/src/lib/memory/SupabaseVectorStore.ts` | 1 | Allowed backend memory infrastructure. |
| `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts` | 2 | Allowed agent/background execution path. |
| `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts` | 2 | Allowed agent/background execution path. |
| `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts` | 1 | Allowed agent/background execution path. |
| `packages/backend/src/config/secretsManager.ts` | 3 | Allowed secrets-management/admin path. |
| `packages/backend/src/config/secrets/SecretAuditLogger.ts` | 1 | Allowed security audit path. |
| `packages/backend/src/workers/billingAggregatorWorker.ts` | 1 | Allowed worker/background path. |
| `packages/backend/src/workers/CertificateGenerationWorker.ts` | 1 | Allowed worker/background path. |
| `packages/backend/src/workers/ArtifactGenerationWorker.ts` | 1 | Allowed worker/background path. |
| `packages/backend/src/analytics/ValueLoopAnalytics.ts` | 2 | Allowed analytics path. |
| `packages/backend/src/runtime/execution-runtime/index.ts` | 1 | Allowed runtime/orchestration infrastructure. |
| `packages/backend/src/runtime/execution-runtime/DecisionContextRepository.ts` | 1 | Allowed runtime/orchestration infrastructure. |
| `packages/backend/src/repositories/IntegrityResultRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/RealizationReportRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/RoiModelCalculationRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/ValueTreeLinkRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/ExpansionOpportunityRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/WorkflowStateRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/ValueTreeNodeRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/RoiModelRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/KpiTargetRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/NarrativeDraftRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/repositories/SupabaseProvenanceStore.ts` | 4 | Allowed provenance/audit infrastructure. |
| `packages/backend/src/repositories/ValueCommitRepository.ts` | 1 | Allowed non-request repository; background/runtime access. |
| `packages/backend/src/services/certificates/CertificateJobRepository.ts` | 1 | Allowed job repository/background use. |
| `packages/backend/src/services/tenant/TenantContextIngestionService.ts` | 2 | Allowed tenant provisioning/ingestion. |
| `packages/backend/src/services/tenant/TenantProvisioningEmail.ts` | 2 | Allowed tenant provisioning. |
| `packages/backend/src/services/tenant/TenantBillingProvisioning.ts` | 1 | Allowed tenant provisioning. |
| `packages/backend/src/services/tenant/TenantArchivalService.ts` | 3 | Allowed tenant archival/background use. |
| `packages/backend/src/services/tenant/TenantUsageProvisioning.ts` | 1 | Allowed tenant provisioning. |
| `packages/backend/src/services/tenant/TenantOrganizationProvisioning.ts` | 2 | Allowed tenant provisioning. |
| `packages/backend/src/services/tenant/TenantDeletionService.ts` | 1 | Allowed tenant deletion/admin use. |
| `packages/backend/src/services/artifacts/ArtifactJobRepository.ts` | 4 | Allowed job/worker support path. |
| `packages/backend/src/services/billing/UsagePersistenceService.ts` | 1 | Allowed billing persistence/background use. |
| `packages/backend/src/services/crm/CrmConnectionService.ts` | 1 | Allowed integration/admin workflow. |
| `packages/backend/src/services/crm/IntegrationControlService.ts` | 3 | Allowed integration/admin workflow. |
| `packages/backend/src/services/crm/AgentPrefetchService.ts` | 1 | Allowed background prefetch workflow. |
| `packages/backend/src/services/crm/CrmHealthService.ts` | 1 | Allowed health/ops workflow. |
| `packages/backend/src/services/crm/ValueCaseScaffolder.ts` | 1 | Allowed provisioning/scaffolding workflow. |
| `packages/backend/src/services/crm/CrmWebhookService.ts` | 1 | Allowed integration webhook workflow. |
| `packages/backend/src/services/crm/TokenReEncryptionJob.ts` | 1 | Allowed security/background job. |
| `packages/backend/src/services/crm/CrmSyncService.ts` | 1 | Allowed sync/background workflow. |
| `packages/backend/src/services/post-v1/EmailAnalysisService.ts` | 1 | Allowed background processing. |
| `packages/backend/src/services/post-v1/AgentFabricService.ts` | 1 | Allowed orchestration/background workflow. |
| `packages/backend/src/services/post-v1/SecurityAuditService.ts` | 1 | Allowed explicit security-audit service. |
| `packages/backend/src/services/post-v1/EventSourcingService.ts` | 1 | Allowed event sourcing infrastructure. |
| `packages/backend/src/services/post-v1/OfflineEvaluation.ts` | 1 | Allowed offline evaluation/background use. |
| `packages/backend/src/services/ground-truth/ChunkEmbedPipeline.ts` | 1 | Allowed embedding/background pipeline. |
| `packages/backend/src/services/deal/CRMConnector.ts` | 1 | Allowed integration/admin workflow. |
| `packages/backend/src/services/security/ComplianceControlStatusService.ts` | 1 | Allowed security/compliance workflow. |
| `packages/backend/src/services/export/PdfExportService.ts` | 1 | Allowed export service. |
| `packages/backend/src/services/security/ComplianceControlCheckService.ts` | 1 | Allowed security/compliance workflow. |
| `packages/backend/src/services/security/SecurityAnomalyService.ts` | 1 | Allowed security/compliance workflow. |
| `packages/backend/src/services/security/AuditLogService.ts` | 1 | Allowed security audit service. |
| `packages/backend/src/services/export/PptxExportService.ts` | 1 | Allowed export service. |
| `packages/backend/src/services/auth/UserProfileDirectoryService.ts` | 1 | Allowed auth/admin directory workflow. |
| `packages/backend/src/services/auth/AuthDirectoryService.ts` | 1 | Allowed auth/admin directory workflow. |
| `packages/backend/src/services/auth/AdminUserService.ts` | 1 | Allowed auth/admin workflow. |
| `packages/backend/src/services/auth/AdminRoleService.ts` | 1 | Allowed auth/admin workflow. |
| `packages/backend/src/services/auth/consentRegistry.ts` | 1 | Allowed auth/compliance workflow. |
