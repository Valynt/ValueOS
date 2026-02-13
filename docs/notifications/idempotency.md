# Notification Idempotency Design Note

## Purpose

Define a consistent idempotency and retry model for notification delivery so all channels can be wired with the same reliability semantics.

## Idempotency key composition

Use deterministic keys that identify one logical delivery intent (not one transport attempt).

### Notification events (generic)

Format:

`notif:{tenantId}:{channel}:{notificationType}:{entityType}:{entityId}:{recipientKey}:{templateVersion}`

Composition rules:

- `tenantId`: required for tenant isolation.
- `channel`: `email`, `webhook`, `in_app`, `sms`.
- `notificationType`: business event name (for example `invoice.past_due`).
- `entityType` + `entityId`: stable source object for dedupe scope.
- `recipientKey`: canonical recipient identity for channel (`userId`, webhook endpoint ID, phone hash).
- `templateVersion`: freeze rendering variant to avoid accidental key collisions across template updates.

### Email events

Format:

`email:{tenantId}:{campaignOrTemplate}:{recipientEmailCanonical}:{businessEventId}:{payloadHash}`

Composition rules:

- `campaignOrTemplate`: logical email template key.
- `recipientEmailCanonical`: lowercase, trimmed address.
- `businessEventId`: immutable domain event ID (preferred) or source aggregate version token.
- `payloadHash`: hash of normalized dynamic variables affecting message body/subject.

## Dedupe enforcement layers

Dedupe is enforced in three layers; all three must stay enabled.

1. **DB unique index (source of truth)**
   - Table: notification/email send ledger.
   - Constraint: unique on `(channel, idempotency_key)` (optionally scoped by `tenant_id` if keys are not globally unique).
   - Guarantees single durable accept of a logical send request.

2. **Outbox consumer guard (runtime safety)**
   - **Touchpoint: `OutboxProcessor`** checks processed-key store before executing side effects.
   - If key already processed, ack and skip side effects.
   - Prevents duplicate executions from redeliveries or consumer restarts.

3. **Provider message-id map (external reconciliation)**
   - **Touchpoint: `ProviderAdapter`** persists mapping `idempotency_key -> provider_message_id/status`.
   - Replays first consult the map; if provider already accepted message, treat as success and avoid re-send.
   - Required for ambiguous timeout cases where upstream accepted but worker did not receive response.

## Retry rules

### Global policy

- `maxAttempts`: **8** total attempts (initial + 7 retries).
- Backoff: exponential with jitter: `delay = min(15m, base * 2^(attempt-1)) + random(0..base)` with `base = 5s`.
- Retryable failures: network errors, 429, 5xx, transient provider timeouts.
- Non-retryable failures: 4xx permanent validation errors (`invalid_recipient`, `template_missing`, `payload_invalid`, `auth_failed`).

### Dead-letter conditions

Message is dead-lettered when either condition is met:

- `attempt >= maxAttempts`, or
- explicit permanent failure classification from channel adapter.

Dead-letter payload must include `idempotencyKey`, `attemptCount`, `lastErrorCode`, `lastErrorMessage`, and `providerMessageId` (if available).

### Worker responsibilities

- **Touchpoint: `EmailWorker`** increments attempt metadata, computes next backoff, and emits DLQ records on terminal failure.
- **Touchpoint: `OutboxProcessor`** handles scheduling of deferred retries and preserves original `idempotencyKey` across attempts.
- **Touchpoint: `ProviderAdapter`** classifies retryable vs permanent errors consistently across providers.

## Delivery guarantees by channel

| Channel | Producer -> outbox | Outbox -> worker | Worker -> provider | Effective guarantee |
| --- | --- | --- | --- | --- |
| Email | Exactly-once enqueue via DB transaction + unique key | At-least-once consumption | At-least-once send attempt with provider-map dedupe | **Effectively once** for accepted provider messages; otherwise at-least-once attempts |
| Webhook | Exactly-once enqueue | At-least-once | At-least-once HTTP delivery | **At-least-once** (receiver must dedupe using event/idempotency key) |
| In-app | Exactly-once write (DB unique key) | N/A or internal fan-out | N/A | **Exactly-once** persistence, at-least-once fan-out to clients |
| SMS (if enabled) | Exactly-once enqueue | At-least-once | At-least-once send attempt with provider-map dedupe | **Effectively once** when provider accepts and message-id map is present |

## Implementation wiring checklist

- `OutboxProcessor`
  - Validate `idempotencyKey` format and required fields.
  - Check processed-key store before dispatch.
  - Preserve key unchanged through retries and DLQ events.
- `EmailWorker`
  - Apply retry policy constants (`maxAttempts`, backoff, permanent-failure short-circuit).
  - Upsert send ledger row guarded by DB unique constraint.
- `ProviderAdapter`
  - Normalize provider errors into shared retry taxonomy.
  - Persist and read `idempotency_key -> provider_message_id` mapping prior to send/retry.

## Operational notes

- Never generate idempotency keys from wall-clock timestamps alone.
- Any schema change that modifies key composition requires versioning and migration strategy for in-flight retries.
- Observability must log `idempotencyKey`, `attempt`, and `providerMessageId` on every dispatch path.
