# Asynchronous workload candidates

This summary highlights current long-running or latency-sensitive work in `src/` that should be offloaded to a message broker or worker pool.

## LLM orchestration and content generation
- **LLM queue processing** (`src/services/MessageQueue.ts`): BullMQ-backed queue already performs multi-attempt processing, persistence to Supabase, and metrics APIs; this should be migrated to the broker for consistent retry/dead-letter semantics.
- **LLM submission API** (`src/api/queue.ts`): HTTP endpoints enqueue and manage LLM jobs; request validation and status/result lookups map cleanly to a broker-backed job controller.

## Notifications and incident response
- **Alert fan-out** (`src/services/AlertingService.ts`): Periodic checks trigger Sentry/email/webhook notifications. The notification delivery stubs should become brokered events so channel-specific workers can retry independently.
- **Secret rotation notifications** (`src/config/secrets/SecretRotationScheduler.ts`): Rotation jobs currently log stakeholder notices; these should emit events so email/Slack webhooks are durable and idempotent.

## External system integrations
- **Billing webhooks** (`src/api/billing/webhooks.ts`): Stripe webhook handling should push downstream reconciliation to the broker to protect the endpoint from latency spikes.
- **CRM synchronisation** (`src/mcp-crm/modules/HubSpotModule.ts`, `src/mcp-crm/modules/SalesforceModule.ts`): High-volume contact/deal sync and recent activity fetches are heavy API calls; brokered jobs with rate limits and backoff will prevent UI latency.

## Data exports and reporting
- **LLM result persistence** (`src/services/MessageQueue.ts`): Supabase writes for job outputs can be performed asynchronously to avoid blocking workers.
- **Future exports**: CSV/PDF data exports and large report generation should publish broker events so fan-out workers can handle generation and storage without impacting frontend responsiveness.
