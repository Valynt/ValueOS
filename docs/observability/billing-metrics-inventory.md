# Billing Metrics Inventory

Canonical inventory of Prometheus metric names exported by `packages/backend/src/metrics/billingMetrics.ts`.

This document is aligned with `docs/observability/billing-metrics-manifest.json` and is intended for alert/rule authors.

| Metric name | Labels |
|---|---|
| `billing_stripe_webhooks_total` | `event_type`, `status` |
| `billing_invoices_processed_total` | `event_type` |
| `billing_jobs_failures_total` | `job`, `reason` |
| `billing_usage_records_unaggregated` | — |
| `billing_stripe_submission_errors_total` | — |
| `billing_webhook_retry_queue_size` | — |
| `billing_pending_aggregates_age_seconds` | — |
| `billing_webhook_unresolved_tenant_total` | — |
| `billing_aggregation_lock_skipped_total` | `tenant_id`, `metric` |
| `billing_duplicate_submission_prevented_total` | `tenant_id`, `metric` |
| `billing_inbound_rate_limited_total` | `tenant_id` |
| `billing_rate_limit_redis_unavailable_total` | — |
| `billing_stripe_submission_total` | — |
| `billing_stripe_submission_duration_seconds` | histogram buckets (`_bucket`, `_sum`, `_count`) |
| `billing_webhook_processing_total` | `event_type` |
| `billing_invoices_unpaid_total` | — |
| `billing_invoices_total` | — |
| `billing_approval_requests_pending_age_seconds` | — |
| `billing_tenant_quota_usage_ratio` | `tenant_id`, `metric` |
| `billing_tenant_overage_amount_dollars` | `tenant_id` |
| `billing_stripe_rate_limited_total` | — |
| `billing_webhook_exhausted_total` | `event_type` |
| `webhooks_received_total` | `event_type` |
| `webhooks_processed_total` | `event_type`, `status` |
| `webhook_dlq_size` | — |
| `webhook_processing_failures_total` | `event_type` |
| `webhook_reconciliation_runs_total` | — |
| `webhook_reconciliation_failures_total` | — |
| `webhook_reconciliation_drift_count` | `tenant_id` |
| `billing_subscription_create_rollback_failures_total` | — |
| `partition_maintenance_last_success_timestamp` | — |
| `partition_maintenance_failures_total` | — |
| `subscription_creation_drift_total` | `tenant_id` |
| `subscription_creation_reconciliation_resolved` | — |
| `webhook_circuit_breaker_open_total` | `event_type` |
| `webhook_circuit_breaker_rejected_total` | `event_type` |
