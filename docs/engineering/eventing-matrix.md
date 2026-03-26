# Eventing Matrix (ADR-backed)

## Purpose

This matrix defines approved eventing technologies and usage boundaries for ValueOS, grounded in ADR decisions so architecture choices remain auditable and enforceable in CI.

## Governing ADRs

- **ADR-0018** — Messaging technology selection (`docs/engineering/adr/0018-messaging-technology-selection.md`)
- **ADR-0001** — Architecture governance (`docs/engineering/adr/0001-architecture-governance.md`)

## Approved matrix

| Technology | Approved role | Approved use-cases | Primary modules | Not approved without ADR/reference tag |
| --- | --- | --- | --- | --- |
| **BullMQ (Redis-backed)** | Background job queueing and async task workers | Long-running/offline workloads, retries/backoff, DLQ handling, bounded worker concurrency, operational queue metrics | `packages/backend/src/workers/*.ts`, `packages/backend/src/services/realtime/MessageQueue.ts` | New queue/worker producers or consumers in other realtime/worker files without explicit architecture reference |
| **NATS (JetStream)** | Canonical internal event bus for inter-agent/domain event streaming | Durable event fan-out, replayable domain events, internal event routing via `MessageBus` abstraction | `packages/backend/src/services/realtime/MessageBus.ts` and adapters using that abstraction | Direct ad-hoc NATS client usage that bypasses `MessageBus`, or new NATS consumers/producers in non-approved modules |
| **Kafka** | External integration/event bridge (not default internal bus) | Connector-facing ingestion/egress, compatibility with external pipelines where Kafka is required | `packages/backend/src/services/realtime/EventProducer.ts`, `packages/backend/src/services/realtime/EventConsumer.ts` (legacy/in-transition) | New internal producer/consumer usage for agent-to-agent messaging without explicit architecture reference |

## Enforcement policy

Architecture lint (`scripts/ci/check-eventing-architecture-tags.mjs`) enforces this matrix for:

- `packages/backend/src/services/realtime/**`
- `packages/backend/src/workers/**`

### Rule

If a file introduces producer/consumer primitives outside the approved module set, it must include an architecture tag in comments:

- `ADR-XXXX` (preferred), **or**
- `EVENTING_REF: <doc-or-adr-reference>`

### Examples

```ts
// ADR-0018: Kafka consumer retained temporarily for external integration bridge.
```

```ts
// EVENTING_REF: docs/engineering/eventing-matrix.md#approved-matrix
```

## Change management

When adding a new eventing producer/consumer pattern:

1. Update ADR-0018 (or add a new ADR) with rationale and consequences.
2. Update this eventing matrix.
3. Update the CI lint allowlist/reference as needed.
