# Chaos Tests

This directory contains the lightweight reliability/chaos acceptance suite used by the shared Vitest lane.

## Scenarios

- `db-transient-outage.test.ts`
  - Simulates a **PostgreSQL connection failure**.
  - Verifies the backend contract returns a **structured `503 Service Unavailable`** payload rather than a raw stack trace.
  - Verifies retry, idempotency, and audit traceability after recovery.
- `queue-outage.test.ts`
  - Simulates **Redis / BullMQ unavailability**.
  - Verifies jobs are **not silently dropped**, are kept in a recoverable backlog while retries are pending, and move to a DLQ with traceability metadata after retry exhaustion.
- `llm-provider-outage.test.ts`
  - Exercises provider outage / retry / bounded-failure handling.
- `crm-billing-failure.test.ts`
  - Exercises downstream partial-failure behavior.
- `partial-execution-recovery.test.ts`
  - Exercises recovery after incomplete multi-step execution.

## How to run

Run the whole chaos suite:

```bash
pnpm exec vitest run --config tests/vitest.shared.config.ts tests/chaos/*.test.ts
```

Run only the new production-readiness scenarios:

```bash
pnpm exec vitest run --config tests/vitest.shared.config.ts tests/chaos/db-transient-outage.test.ts tests/chaos/queue-outage.test.ts
```

Run the release-oriented launcher that includes these scenarios:

```bash
node scripts/chaos/launch-chaos-smoke.mjs
```

## Acceptance mapping

- **Database outage acceptance:** `db-transient-outage.test.ts`
- **Redis/BullMQ outage acceptance:** `queue-outage.test.ts`
- **Launch smoke evidence artifact generation:** `scripts/chaos/launch-chaos-smoke.mjs`
