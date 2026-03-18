# Tasks: Core Services Integration Testing

## 1. Database Migration Validation

- [ ] 1.1 Run `pnpm run db:migrate` in cloud-dev environment
- [ ] 1.2 Verify 4 migrations apply successfully (value-modeling, billing-v2, deal-assembly, trust-layer)
- [ ] 1.3 Confirm all tables created: assumptions, scenarios, billing_meters, billing_price_versions, deal_contexts, stakeholders, use_cases, provenance_records, case_readiness_scores
- [ ] 1.4 Validate RLS policies applied on all tables
- [ ] 1.5 Test rollback scripts execute without errors
- [ ] 1.6 Run `pnpm run test:rls` - verify 0 failures

## 2. Service Unit Tests

- [ ] 2.1 Write unit tests for `CRMConnector.fetchDealContext()`
- [ ] 2.2 Write unit tests for `ContextExtractionAgent.execute()`
- [ ] 2.3 Write unit tests for `DealAssemblyAgent.execute()`
- [ ] 2.4 Write unit tests for `SECEdgarClient.getCIK()` and `fetchLatest10K()`
- [ ] 2.5 Write unit tests for `XBRLParser.parseCompanyFacts()`
- [ ] 2.6 Write unit tests for `ReadinessScorer.computeReadiness()`
- [ ] 2.7 Write unit tests for `PlausibilityClassifier.assessPlausibility()`
- [ ] 2.8 Write unit tests for `PromiseBaselineService.createFromApprovedCase()`
- [ ] 2.9 Write unit tests for `ArtifactGeneratorService.generateArtifact()`

## 3. Integration Tests

- [ ] 3.1 Integration test: CRM → DealAssembly → Database persistence
- [ ] 3.2 Integration test: SEC EDGAR → XBRL → Ground Truth pipeline
- [ ] 3.3 Integration test: Assumptions → ReadinessScorer → PlausibilityClassifier
- [ ] 3.4 Integration test: Scenario approval → PromiseBaseline → Checkpoints
- [ ] 3.5 Integration test: Full workflow from DealContext to Artifact generation
- [ ] 3.6 Test compensation handlers on workflow failure

## 4. Tenant Isolation & Security

- [ ] 4.1 Verify `assertTenantContextMatch()` called in all agents
- [ ] 4.2 Test cross-tenant data access is blocked
- [ ] 4.3 Validate `security.user_has_tenant_access()` in RLS policies
- [ ] 4.4 Test RBAC enforcement: owner, admin, member, viewer roles
- [ ] 4.5 Test secret permission enforcement (secrets:read, secrets:write)
- [ ] 4.6 Verify service_role client only used in AuthService, tenant provisioning

## 5. TypeScript & Lint Validation

- [ ] 5.1 Run `pnpm run type-check` - fix all errors in strict mode
- [ ] 5.2 Run `pnpm run lint` - fix all lint errors
- [ ] 5.3 Verify no `any` type usage in new services
- [ ] 5.4 Fix import paths in test files
- [ ] 5.5 Add missing type declarations for test helpers

## 6. Test Coverage

- [ ] 6.1 Measure current coverage for new services
- [ ] 6.2 Target: >70% coverage for all new services
- [ ] 6.3 Update vitest.config.ts coverage thresholds
- [ ] 6.4 Generate coverage report

## 7. Security Scan

- [ ] 7.1 Run `pnpm run security:scan`
- [ ] 7.2 Verify zero high-severity findings
- [ ] 7.3 Document any accepted low/medium risks

## 8. CI/CD Pipeline Validation

- [ ] 8.1 Verify GitHub Actions workflow runs all test stages
- [ ] 8.2 Test fail on TypeScript error
- [ ] 8.3 Test fail on lint error
- [ ] 8.4 Test fail on test failure
- [ ] 8.5 Test fail on RLS violation

## 9. Documentation

- [ ] 9.1 Document test setup instructions in README
- [ ] 9.2 Document mock configuration for external APIs
- [ ] 9.3 Document test data factory usage
- [ ] 9.4 Update API documentation with endpoint contracts

## 10. Sign-off

- [ ] 10.1 All unit tests passing
- [ ] 10.2 All integration tests passing
- [ ] 10.3 Coverage >70% for new code
- [ ] 10.4 Zero high-severity security findings
- [ ] 10.5 TypeScript strict mode clean
- [ ] 10.6 RLS policies validated
- [ ] 10.7 Ready for production readiness review
