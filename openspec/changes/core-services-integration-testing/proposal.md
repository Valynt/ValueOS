# Proposal: Core Services Integration Testing

## Summary

Execute comprehensive integration testing for all V1 core backend services to validate system-wide data flow, tenant isolation, and service orchestration before production deployment.

## Motivation

After implementing all 10 Spec domains and ~355 backend/infra tasks across Auth, Billing, Deal Assembly, Ground Truth, Trust Layer, Promise Baseline, and Executive Output services, we need to verify:

1. **Service Orchestration** - Agents and services work together correctly
2. **Tenant Isolation** - No data leakage across tenant boundaries
3. **Database Integrity** - Migrations apply cleanly with proper RLS policies
4. **API Contracts** - All endpoints return expected data shapes
5. **Security** - RBAC enforcement prevents unauthorized access

## Success Criteria

- All 4 database migrations apply successfully with zero errors
- Unit test coverage >70% for all new services
- Integration tests pass for end-to-end workflows
- RLS policies validated with `test:rls`
- No TypeScript errors in strict mode
- Security scan passes with zero high-severity findings

## Scope

### In Scope
- Database migration validation
- Service-to-service integration tests
- Agent orchestration testing
- Tenant isolation verification
- API endpoint contract testing

### Out of Scope
- Frontend UI testing (separate change)
- Performance/load testing (separate change)
- Production deployment (requires additional change)

## Timeline

Target completion: 2-3 days
Priority: High (blocks production readiness)

## Risks

| Risk | Mitigation |
|------|------------|
| Migration conflicts with existing data | Rollback scripts tested |
| Test environment misconfiguration | Use cloud-dev environment |
| Service dependency failures | Mock external APIs (SEC EDGAR, HubSpot) |

## References

- openspec/changes/value-modeling-engine/
- openspec/changes/billing-v2/
- openspec/changes/deal-assembly-pipeline/
- openspec/changes/ground-truth-integration/
- openspec/changes/trust-layer-completion/
- openspec/changes/promise-baseline-handoff/
- openspec/changes/executive-output-generation/
