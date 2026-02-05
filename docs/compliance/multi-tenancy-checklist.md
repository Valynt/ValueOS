# Multi-Tenancy Security Audit

## 1. Request Context & Tenant Binding

- [x] Every HTTP request extracts `organization_id` from JWT claims (evidence: packages/backend/src/middleware/auth.ts)
- [x] `organization_id` stored in request context (not URL parameter for core data) (evidence: packages/backend/src/middleware/tenantContext.ts)
- [x] All database queries filtered by `organization_id` (evidence: packages/backend/src/middleware/tenantDbContext.ts, packages/backend/src/api/workflow.ts, packages/backend/src/repositories/WorkflowStateRepository.ts)
- [ ] No exceptions for "admin" users without explicit role checks
  - Location: packages/backend/src/middleware/rbac.ts
- [ ] Agent execution scoped to request organization
  - Location: packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts
- [ ] API key scopes include organization_id restriction
  - Location: packages/backend/src/middleware/apiKeyRateLimiter.ts

## 2. Data Access Layer

- [x] All ORM queries use `.filter(Model.organization_id == org_id)` (evidence: packages/backend/src/repositories/WorkflowStateRepository.ts)
- [x] Raw SQL queries include tenant filter in WHERE clause (evidence: packages/backend/src/api/workflow.ts)
- [ ] No SELECT \* without WHERE organization_id = ?
  - Location: packages/backend/src/repositories/WorkflowStateRepository.ts
- [ ] Joins across tables include organization_id in join conditions
  - Location: packages/backend/src/services/TenantAwareService.ts
- [ ] Subqueries filtered by organization_id
  - Location: packages/backend/src/services/TenantAwareService.ts
- [ ] Aggregate functions (COUNT, SUM) filtered by organization_id
  - Location: packages/backend/src/services/TenantAwareService.ts

## 3. Agent & Orchestration Layer

- [ ] Agent initialization includes organization_id parameter
  - Location: packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts
- [ ] Agent memory (vector store, cache) namespaced by organization_id
  - Location: packages/backend/src/services/memory/MemoryPipeline.ts
- [ ] Agent tools receive organization context
  - Location: packages/backend/src/services/MCPTools.ts
- [ ] Agent outputs filtered before returning to user
  - Location: packages/backend/src/services/AgentOutputListener.ts
- [ ] No cross-tenant data in agent prompts/context
  - Location: packages/backend/src/lib/agent-fabric/TaskContext.ts

## 4. Cache Layer (Redis/Memcached)

- [x] Cache keys prefixed with organization_id: `{org_id}:model:{model_id}` (evidence: packages/backend/src/services/CacheService.ts)
- [ ] Cache invalidation on multi-tenant boundary
  - Location: packages/backend/src/services/CacheService.ts
- [ ] No global caches without organization scoping
  - Location: packages/backend/src/services/CacheService.ts

## 5. Search & Indexing

- [ ] Elasticsearch/similar: documents include organization_id field
  - Location: packages/backend/src/services/VectorSearchService.ts
- [ ] Search queries include organization_id filter
  - Location: packages/backend/src/services/VectorSearchService.ts
- [ ] Full-text search scoped to tenant
  - Location: packages/backend/src/services/VectorSearchService.ts

## 6. File Storage & CDN

- [ ] S3 keys include organization_id: `s3://bucket/{org_id}/...`
  - Location: packages/backend/src/config/schema.ts
- [ ] Pre-signed URLs scoped to organization
  - Location: packages/backend/src/config/schema.ts
- [ ] CloudFront cache behaviors include organization in headers
  - Location: packages/backend/src/config/schema.ts

## 7. Audit & Logging

- [ ] Every data access logged with organization_id
  - Location: packages/backend/src/services/security/AuditTrailService.ts
- [ ] Audit log queries include organization_id filter
  - Location: packages/backend/src/services/security/AuditTrailService.ts
- [ ] No cross-tenant log aggregation without filtering
  - Location: packages/backend/src/services/security/AuditTrailService.ts

## 8. Authentication & Secrets

- [ ] JWT payload includes organization_id (claim: 'org_id')
  - Location: packages/backend/src/middleware/auth.ts
- [ ] API keys scoped to organization
  - Location: packages/backend/src/middleware/apiKeyRateLimiter.ts
- [ ] Service-to-service tokens include organization context
  - Location: packages/backend/src/middleware/serviceIdentityMiddleware.ts
- [ ] No hardcoded secrets in code or config
  - Location: packages/backend/src/config/secretsManager.ts
- [ ] Secrets rotated every 90 days
  - Location: packages/backend/src/services/security/APIKeyRotationService.ts
- [ ] AWS Secrets Manager or HashiCorp Vault used
  - Location: packages/backend/src/config/secrets/AWSSecretProvider.ts

## 9. Error Handling

- [x] 404 returned for non-existent or unauthorized resources (not 403) (evidence: packages/backend/src/middleware/tenantContext.ts, packages/backend/src/api/workflow.ts)
- [x] No data leakage in error messages (evidence: packages/backend/src/middleware/tenantContext.ts, packages/backend/src/services/TenantAwareService.ts)
- [ ] Error logs don't expose tenant data
  - Location: packages/backend/src/middleware/globalErrorHandler.ts

## 10. Testing

- [x] Unit tests verify organization_id filtering (evidence: src/lib/rules/**tests**/RulesEnforcer.test.ts)
- [x] Integration tests verify cross-tenant isolation (evidence: packages/backend/src/api/__tests__/workflow.integration.test.ts, supabase/tests/database/multi_tenant_rls.test.sql in secure CI RLS stage)
- [ ] Penetration tests attempt cross-tenant access
  - Location: tests/compliance/
