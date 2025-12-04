# Multi-Tenancy Security Audit

## 1. Request Context & Tenant Binding
- [ ] Every HTTP request extracts `organization_id` from JWT claims
- [ ] `organization_id` stored in request context (not URL parameter for core data)
- [ ] All database queries filtered by `organization_id` 
- [ ] No exceptions for "admin" users without explicit role checks
- [ ] Agent execution scoped to request organization
- [ ] API key scopes include organization_id restriction

## 2. Data Access Layer
- [ ] All ORM queries use `.filter(Model.organization_id == org_id)`
- [ ] Raw SQL queries include tenant filter in WHERE clause
- [ ] No SELECT * without WHERE organization_id = ?
- [ ] Joins across tables include organization_id in join conditions
- [ ] Subqueries filtered by organization_id
- [ ] Aggregate functions (COUNT, SUM) filtered by organization_id

## 3. Agent & Orchestration Layer
- [ ] Agent initialization includes organization_id parameter
- [ ] Agent memory (vector store, cache) namespaced by organization_id
- [ ] Agent tools receive organization context
- [ ] Agent outputs filtered before returning to user
- [ ] No cross-tenant data in agent prompts/context

## 4. Cache Layer (Redis/Memcached)
- [ ] Cache keys prefixed with organization_id: `{org_id}:model:{model_id}`
- [ ] Cache invalidation on multi-tenant boundary
- [ ] No global caches without organization scoping

## 5. Search & Indexing
- [ ] Elasticsearch/similar: documents include organization_id field
- [ ] Search queries include organization_id filter
- [ ] Full-text search scoped to tenant

## 6. File Storage & CDN
- [ ] S3 keys include organization_id: `s3://bucket/{org_id}/...`
- [ ] Pre-signed URLs scoped to organization
- [ ] CloudFront cache behaviors include organization in headers

## 7. Audit & Logging
- [ ] Every data access logged with organization_id
- [ ] Audit log queries include organization_id filter
- [ ] No cross-tenant log aggregation without filtering

## 8. Authentication & Secrets
- [ ] JWT payload includes organization_id (claim: 'org_id')
- [ ] API keys scoped to organization
- [ ] Service-to-service tokens include organization context
- [ ] No hardcoded secrets in code or config
- [ ] Secrets rotated every 90 days
- [ ] AWS Secrets Manager or HashiCorp Vault used

## 9. Error Handling
- [ ] 404 returned for non-existent or unauthorized resources (not 403)
- [ ] No data leakage in error messages
- [ ] Error logs don't expose tenant data

## 10. Testing
- [x] Unit tests verify organization_id filtering (evidence: src/lib/rules/__tests__/RulesEnforcer.test.ts)
- [x] Integration tests verify cross-tenant isolation (evidence: supabase/tests/database/multi_tenant_rls.test.sql in secure CI RLS stage)
- [ ] Penetration tests attempt cross-tenant access
