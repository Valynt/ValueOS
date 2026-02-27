---
name: backend-service-scaffolding
description: |
  Scaffold new backend services in the ValueOS monorepo with tenant isolation,
  Zod validation, audit logging, error handling, and co-located tests.
  Use when asked to: create a new service, add a backend service, scaffold a
  service class, add CRUD operations for a new entity, create a tenant-aware
  service, or add a new domain service.
  Triggers: "new service", "create service", "scaffold service", "add service",
  "backend service", "CRUD service", "tenant-aware service", "domain service",
  "service for <entity>".
---

# Backend Service Scaffolding

Standard for creating backend services in `packages/backend/src/services/`.

## Decision: Which Base Class?

| Scenario | Base class | Import |
|---|---|---|
| Service queries Supabase with user-facing data | `TenantAwareService` | `./TenantAwareService.js` |
| Service queries Supabase with a fixed table + generic CRUD | `BaseTenantService<T>` | `./base-tenant-service.js` |
| Service has no direct Supabase queries (orchestration, computation) | `BaseService` | `./BaseService.js` |

Default to `TenantAwareService` unless there is a clear reason not to.

## Workflow

### Step 1: Gather Requirements

Determine:
1. **Entity name** (e.g., `Playbook`, `Campaign`)
2. **Table name** in Supabase (e.g., `playbooks`, `campaigns`)
3. **Operations needed** (list, getById, create, update, delete, custom)
4. **Whether it needs audit logging** (yes for any CUD operation)

### Step 2: Create the Service File

Location: `packages/backend/src/services/<EntityName>Service.ts`

Follow the template in [references/service-template.md](references/service-template.md).

Key rules:
- Extend the chosen base class (see decision table above)
- Define Zod schemas for create/update inputs — no `any` in public method signatures
- Every Supabase query MUST include `.eq("organization_id", orgId)` or use `queryWithTenantCheck` / `scopedQuery`
- Use `createLogger({ component: "<EntityName>Service" })` for logging
- Export the class as a named export (no default exports)
- Export a singleton instance at the bottom if the service is stateless
- Use `ErrorCode` enums from `./errors.js` for error handling

### Step 3: Create the Test File

Location: `packages/backend/src/services/__tests__/<EntityName>Service.test.ts`

Follow the template in [references/test-template.md](references/test-template.md).

Key rules:
- Mock `supabase` via `vi.mock('../../lib/supabase', ...)`
- Mock the chainable Supabase API: `from → select/insert/update/delete → eq → single`
- Test tenant isolation: verify `.eq("organization_id", ...)` is called
- Test error paths: Supabase errors, not-found, validation failures
- Use `vi.clearAllMocks()` in `beforeEach`

### Step 4: Wire Exports

Add to `packages/backend/src/services/index.ts`:
```typescript
export { <EntityName>Service } from "./<EntityName>Service.js"
export { <entityName>Service } from "./<EntityName>Service.js"  // if singleton
```

### Step 5: Verify

Run:
```bash
pnpm test -- packages/backend/src/services/__tests__/<EntityName>Service.test.ts
pnpm run lint
```

## Anti-Patterns

| Pattern | Why it's wrong | Fix |
|---|---|---|
| `supabase.from("x").select("*")` without tenant filter | Tenant data leak | Add `.eq("organization_id", orgId)` |
| `as any` in method signatures | Bypasses type safety | Use Zod schema + inferred type |
| `service_role` client for user-facing queries | Bypasses RLS | Use standard client with tenant filter |
| String concatenation for error messages | Inconsistent errors | Use `ServiceError` with `ErrorCode` |
| Direct `console.log` | No structured logging | Use `createLogger` |
| Default export | Breaks tree-shaking, violates convention | Named export only |

## Constraints

- TypeScript strict mode. No `any` — use `unknown` + type guards or Zod `.parse()`.
- Named exports only.
- Zod for all runtime validation of inputs.
- Every DB query filters on `organization_id` or `tenant_id`.
- Audit trail for create/update/delete operations.
