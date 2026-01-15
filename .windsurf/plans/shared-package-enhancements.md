# 5 Enhancements to @valueos/shared Architecture

Propose 5 targeted enhancements to strengthen the shared package as the foundation layer, improving type safety, error handling, and cross-package contracts.

---

## Current State Summary

| Layer | Contents | Status |
|-------|----------|--------|
| Types | `api.ts`, `domain.ts` | Basic request/response + entities |
| Schemas | `api.ts` (Zod) | API validation only |
| Constants | Tiers, roles, HTTP codes | Minimal |
| Lib | logger, context, env, permissions, supabase, redis, health | Mature |

---

## Proposed Enhancements

### 1. Result Type Pattern

**Problem**: No standardized error handling across packages. Functions return `T | undefined` or throw, making error flows inconsistent.

**Solution**: Add a `Result<T, E>` monad with utilities.

```typescript
// types/result.ts
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),
  err: <E>(error: E): Result<never, E> => ({ ok: false, error }),
  map: <T, U, E>(result: Result<T, E>, fn: (v: T) => U): Result<U, E> => ...
  unwrapOr: <T, E>(result: Result<T, E>, fallback: T): T => ...
};
```

**Files**: `src/types/result.ts`, update `src/types/index.ts`

---

### 2. Typed Domain Events

**Problem**: No typed event contracts for cross-package communication (agent events, memory events, etc.).

**Solution**: Add a type-safe event registry with discriminated unions.

```typescript
// types/events.ts
export type DomainEvent =
  | { type: 'user.created'; payload: { userId: string; tenantId: string } }
  | { type: 'agent.task.completed'; payload: { agentId: string; taskId: string; result: unknown } }
  | { type: 'memory.stored'; payload: { memoryId: string; vectorId?: string } };

export type EventType = DomainEvent['type'];
export type EventPayload<T extends EventType> = Extract<DomainEvent, { type: T }>['payload'];
```

**Files**: `src/types/events.ts`, update `src/types/index.ts`

---

### 3. Schema-Derived Types + Validation Utilities

**Problem**: Types and schemas are manually kept in sync. No composable validation helpers.

**Solution**: Derive types from Zod schemas and add validation utilities.

```typescript
// schemas/domain.ts
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  plan: z.enum(['free', 'standard', 'enterprise']),
  createdAt: z.coerce.date(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// lib/validation.ts
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): Result<T, z.ZodError>;
export function validateAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<Result<T, z.ZodError>>;
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null;
```

**Files**: `src/schemas/domain.ts`, `src/lib/validation.ts`

---

### 4. ID Generation Utilities

**Problem**: No standard ID generation. Different packages use different formats (uuid, cuid, prefixed IDs).

**Solution**: Centralized ID utilities with type-safe prefixes.

```typescript
// lib/ids.ts
export const ids = {
  uuid: () => crypto.randomUUID(),
  prefixed: <P extends string>(prefix: P) => `${prefix}_${nanoid(21)}` as `${P}_${string}`,

  // Domain-specific generators
  user: () => ids.prefixed('usr'),
  tenant: () => ids.prefixed('ten'),
  agent: () => ids.prefixed('agt'),
  task: () => ids.prefixed('tsk'),
  memory: () => ids.prefixed('mem'),
};

export type UserId = ReturnType<typeof ids.user>;
export type TenantId = ReturnType<typeof ids.tenant>;
```

**Files**: `src/lib/ids.ts`, add `nanoid` to dependencies

---

### 5. Retry & Backoff Utilities

**Problem**: No standard retry logic. Each package implements its own retry/backoff.

**Solution**: Composable retry utilities with exponential backoff.

```typescript
// lib/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOn?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<Result<T, Error>>;

export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<RetryOptions>
): T;
```

**Files**: `src/lib/retry.ts`

---

## Implementation Order

1. **Result type** → Foundation for other enhancements
2. **Validation utilities** → Uses Result type
3. **ID generation** → Standalone, no dependencies
4. **Domain events** → Type definitions only
5. **Retry utilities** → Uses Result type

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/result.ts` | Create |
| `src/types/events.ts` | Create |
| `src/schemas/domain.ts` | Create |
| `src/lib/validation.ts` | Create |
| `src/lib/ids.ts` | Create |
| `src/lib/retry.ts` | Create |
| `src/types/index.ts` | Update exports |
| `src/schemas/index.ts` | Update exports |
| `src/index.ts` | Update exports |
| `package.json` | Add `nanoid` dependency |

---

## Estimated Impact

- **Type safety**: Result pattern eliminates `null`/`undefined` ambiguity
- **Consistency**: Standardized IDs and events across all packages
- **DRY**: Schema-derived types prevent drift
- **Reliability**: Retry utilities reduce boilerplate and improve resilience
