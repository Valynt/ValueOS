# Event contracts and schemas

All brokered messages use JSON payloads with explicit versions to enable schema evolution. Each event includes:
- `schemaVersion`: semantic version string (e.g., `1.0.0`).
- `idempotencyKey`: unique key per logical action so consumers can safely deduplicate.
- `emittedAt`: ISO 8601 timestamp from the producer.
- Event-specific payload fields described below.

## Event catalog

| Event name | Purpose | Required fields | Version notes |
| --- | --- | --- | --- |
| `notifications.email.requested` | Send templated transactional email with metadata for audit/analytics. | `tenantId`, `recipient`, `template`, `variables`, `schemaVersion`, `idempotencyKey`, `emittedAt` | Add optional attachments via `variables` to avoid breaking changes. |
| `notifications.webhook.dispatch` | Deliver signed webhook payloads to partner endpoints. | `tenantId`, `targetUrl`, `body`, `signature`, `schemaVersion`, `idempotencyKey`, `emittedAt`, optional `retryCount` | If retry policies change, bump minor version and add `policy` block. |
| `data.export.requested` | Kick off potentially long-running CSV/PDF exports. | `tenantId`, `exportType`, `requestedBy`, `filters`, `schemaVersion`, `idempotencyKey`, `emittedAt`, optional `notifyOnCompletion` | Include export destination details in `notifyOnCompletion` envelope. |
| `billing.usage.reported` | Persist metering snapshots outside request/response cycle. | `tenantId`, `periodStart`, `periodEnd`, `usage`, `schemaVersion`, `idempotencyKey`, `emittedAt` | Treat `usage` as a map of numeric counters to keep backward compatibility. |

## Schema governance
- **Validation**: Producers and consumers validate payloads against shared Zod schemas before publishing/processing. Invalid payloads are rejected before hitting the broker.
- **Versioning**: Breaking field removals/renames require a major version bump. Additive fields increment the minor version and stay backward compatible.
- **Idempotency**: Producers must set a deterministic `idempotencyKey` (e.g., Stripe event ID, export request hash, user+timestamp tuple). Consumers store processed keys with a TTL to prevent duplicate side effects.
- **Dead-lettering**: After the configured `maxDeliveries`, messages are copied to `<stream>:dlq` with `failureReason` and `lastError` so operators can replay safely once issues are resolved.
