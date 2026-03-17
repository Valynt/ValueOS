# ADR 0018: Messaging Technology Selection

- **Status:** Accepted
- **Date:** 2026-03-17
- **Context:**
  - The ValueOS codebase contains three messaging technologies: NATS JetStream (`infra/k8s/base/nats-jetstream.yaml`), Redis Streams (`infra/k8s/base/redis-streams.yaml`), and KafkaJS (backend dependency). The comprehensive repo audit (March 2026) flagged this as a source of architectural confusion with no documented rationale for the coexistence.
  - Inter-agent communication uses `MessageBus` (CloudEvents format) as the abstraction layer, defined in `packages/backend/src/services/MessageBus.ts`.
  - The platform needs durable messaging for agent-to-agent communication, job queuing for background tasks, and real-time event streaming for UI updates.

- **Decision:**
  - **NATS JetStream** is the canonical messaging system for inter-agent communication and domain event streaming. It provides durable subscriptions, replay, and CloudEvents-native delivery that aligns with the `MessageBus` abstraction.
  - **Redis (BullMQ)** remains the canonical system for job queuing, rate limiting, idempotency, and agent kill switches. Redis Streams configuration in K8s is retained to support BullMQ's internal stream usage but is not used as a standalone messaging bus.
  - **KafkaJS** is designated as a future integration point for external system connectors (CRM webhooks, analytics pipelines) but is not used for internal agent messaging. It should not be adopted for new internal messaging use cases without revisiting this ADR.
  - The `MessageBus` abstraction in `packages/backend/src/services/MessageBus.ts` must remain the sole entry point for inter-agent messaging. Direct NATS or Kafka client usage from agent code is prohibited.

- **Consequences:**
  - New agent messaging features must use `MessageBus` (backed by NATS JetStream).
  - Background job processing continues to use BullMQ (Redis-backed).
  - KafkaJS dependency is retained but scoped to `packages/integrations/` for external connectors only.
  - The K8s NATS JetStream deployment is the production messaging backbone; Redis Streams config supports BullMQ internals.
  - This decision should be revisited if message volume exceeds NATS JetStream capacity (benchmark: 100k msgs/sec per subject) or if Kafka is needed for log aggregation pipelines.

- **Alternatives Considered:**
  - **Kafka-only:** Higher operational complexity for the current scale. Kafka excels at high-throughput log streaming but is heavyweight for agent-to-agent RPC-style messaging.
  - **Redis Streams-only:** Lacks durable consumer groups with replay semantics needed for agent message audit trails. BullMQ uses Redis Streams internally but the abstraction is job-oriented, not event-oriented.
  - **NATS-only (replacing BullMQ):** NATS JetStream can handle job queuing but BullMQ's retry, backoff, and DLQ semantics are more mature for background processing.
