# Status Enum Mapping

Canonical documentation for status enum alignment across the value model.

## Overview

ValueOS uses different status vocabularies at different architectural layers:
- **API/Database**: `CaseStatus` — workflow state of a value case
- **Domain Model**: `OpportunityStatus` — sales outcome of an opportunity
- **Domain Model**: `BusinessCaseStatus` — review/approval state of a business case artifact

This is intentional separation of concerns. This document provides the mapping between them.

---

## API/Database: CaseStatus

**Location:** `packages/backend/src/api/valueCases/types.ts`
**Database Constraint:** `value_cases.status` check constraint
**Migration:** `20260323000002_value_cases_consistency_alignment.sql`

```typescript
['draft', 'in_progress', 'committed', 'closed']
```

| Status | Meaning | Next States |
|--------|---------|-------------|
| `draft` | Initial creation, not yet active | `in_progress` |
| `in_progress` | Active work, hypotheses being generated | `committed`, `closed` |
| `committed` | Value case validated and committed to | `closed` |
| `closed` | Case completed or abandoned | — |

**Legacy Migration:**
- `review` → `in_progress`
- `published` → `committed`
- `archived` → `closed`

---

## Domain: OpportunityStatus

**Location:** `packages/shared/src/domain/Opportunity.ts`

```typescript
['active', 'on_hold', 'closed_won', 'closed_lost']
```

| Status | Meaning |
|--------|---------|
| `active` | Opportunity is actively being worked |
| `on_hold` | Temporarily paused |
| `closed_won` | Deal won, value case realized |
| `closed_lost` | Deal lost, opportunity abandoned |

---

## Domain: BusinessCaseStatus

**Location:** `packages/shared/src/domain/BusinessCase.ts`

```typescript
['draft', 'in_review', 'approved', 'presented', 'archived']
```

| Status | Meaning | Integrity Gate |
|--------|---------|----------------|
| `draft` | Being composed | N/A |
| `in_review` | Pending integrity validation | Requires `integrity_score >= 0.6` |
| `approved` | Passed review, ready to present | — |
| `presented` | Delivered to customer | — |
| `archived` | Historical record | — |

---

## Cross-Layer Mapping

### CaseStatus ↔ OpportunityStatus

When a value case transitions, the associated opportunity may transition:

| CaseStatus | OpportunityStatus | Trigger |
|------------|-------------------|---------|
| `draft` | `on_hold` | Case not yet ready |
| `in_progress` | `active` | Work started |
| `committed` | `active` | Value committed |
| `closed` | `closed_won` or `closed_lost` | Case completion |

### CaseStatus ↔ BusinessCaseStatus

A value case may have an associated business case artifact:

| CaseStatus | BusinessCaseStatus | Notes |
|------------|-------------------|-------|
| `draft` | `draft` | Parallel composition |
| `in_progress` | `draft` → `in_review` | Review starts when model complete |
| `committed` | `approved` → `presented` | Commitment follows approval |
| `closed` | `archived` | Archive after closure |

---

## Implementation Notes

1. **Bridge mapping belongs in service layer.** Do not import domain types into API types or vice versa. Map at the service boundary.

2. **integrity_score gates advancement.** From `canAdvanceStage()` in `Opportunity.ts`:
   - Requires `integrity_score >= 0.6`
   - Requires `integrity_check_passed === true`

3. **Database constraint enforcement.** The DB check constraint ensures only valid CaseStatus values are persisted:
   ```sql
   CONSTRAINT value_cases_status_check CHECK (
       status = ANY (ARRAY['draft', 'in_progress', 'committed', 'closed'])
   )
   ```

4. **Migration path.** See `20260323000002_value_cases_consistency_alignment.sql` for:
   - Column additions (`integrity_score`, `integrity_evaluated_at`)
   - Constraint updates
   - Data migration from old status values

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/backend/src/api/valueCases/types.ts` | API CaseStatus enum |
| `packages/shared/src/domain/Opportunity.ts` | Domain OpportunityStatus |
| `packages/shared/src/domain/BusinessCase.ts` | Domain BusinessCaseStatus |
| `infra/supabase/supabase/migrations/20260323000002_value_cases_consistency_alignment.sql` | DB alignment migration |
| `packages/backend/src/api/valueCases/repository.ts` | DB mapping layer |
