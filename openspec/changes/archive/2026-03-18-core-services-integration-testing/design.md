# Design: Core Services Integration Testing

## Overview

This change implements comprehensive integration testing for all V1 core services. The testing strategy covers four layers: database migrations, service integration, agent orchestration, and security/tenant isolation.

## Testing Layers

### Layer 1: Database Migration Validation

**Purpose**: Verify all 4 new migrations apply cleanly with proper RLS policies

**Approach**:
1. Run `pnpm run db:migrate` in cloud-dev environment
2. Verify all tables created with correct columns
3. Validate RLS policies are applied
4. Test rollback scripts work correctly

**Migrations to Test**:
- `20260318160647_value_modeling_assumptions_scenarios.sql`
- `20260318160751_billing_v2_core_tables.sql`
- `20260318161110_deal_assembly_tables.sql`
- `20260318161200_trust_layer_provenance.sql`

### Layer 2: Service Integration Tests

**Purpose**: Validate services can communicate and share data correctly

**Services to Test**:
- `CRMConnector` → `DealAssemblyAgent` data flow
- `SECEdgarClient` → `XBRLParser` → Ground Truth pipeline
- `ReadinessScorer` → `PlausibilityClassifier` scoring pipeline
- `PromiseBaselineService` checkpoint scheduling
- `ArtifactGeneratorService` artifact persistence

**Mock Strategy**:
- HubSpot API: Mock responses in CRMConnector tests
- SEC EDGAR API: Mock filing data in SECEdgarClient tests
- LLM Gateway: Mock responses in agent tests

### Layer 3: Agent Orchestration Tests

**Purpose**: Verify agents execute workflows in correct sequence

**Workflows to Test**:
1. Deal Assembly: CRM → Extraction → Assembly → Persist
2. Value Modeling: Hypothesis → Baseline → Scenarios → Sensitivity
3. Trust Layer: Evidence → Confidence → Plausibility → Readiness
4. Promise Baseline: Approval → Snapshot → Checkpoints → Handoff

**Compensation Testing**:
- Verify rollback handlers restore previous state on failure

### Layer 4: Security & Tenant Isolation

**Purpose**: Ensure no cross-tenant data access

**Tests**:
- RLS policy enforcement with `pnpm run test:rls`
- RBAC permission checks in RbacService
- Service role client only used in authorized contexts
- Secret permission enforcement (secrets:read, secrets:write, etc.)

## Test Infrastructure

### Test Database Setup
```bash
# Use separate test schema
pnpm run db:test:setup

# Run migrations
cd packages/backend
pnpm exec supabase migration up
```

### Mock Configuration
- External APIs use nock or vi.fn() mocking
- LLM responses use deterministic test fixtures
- Database queries use in-memory Supabase mock

### Test Data Factories
Located in `packages/backend/src/services/__tests__/integration/helpers/testHelpers.ts`:
- `factories.benchmark()` - Create benchmark records
- `factories.assumption()` - Create assumption records
- `factories.case()` - Create value case records

## Success Metrics

| Metric | Target |
|--------|--------|
| Migration success rate | 100% |
| Unit test coverage | >70% |
| Integration test pass rate | 100% |
| RLS policy validation | 0 failures |
| TypeScript strict mode | 0 errors |

## CI/CD Integration

Tests run in GitHub Actions workflow:
1. `pnpm run lint` - No lint errors
2. `pnpm run type-check` - No TypeScript errors
3. `pnpm run test:unit` - All unit tests pass
4. `pnpm run test:integration` - All integration tests pass
5. `pnpm run test:rls` - RLS policies valid
6. Security scan - Zero high-severity findings
