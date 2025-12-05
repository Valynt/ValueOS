# Billing schema & row-level security

This migration introduces tenant-scoped billing primitives that keep every query pinned to the current organization via `auth.get_current_org_id()`.

## What was added
- **Plans**: `billing_plans` holds per-tenant plan definitions, price points, feature flags, and limit payloads.
- **Subscriptions**: `billing_subscriptions` records the tenant's active plan, lifecycle dates, and external payment references.
- **Entitlements**: `billing_entitlements` captures feature-level limits (hard/soft/metered) tied to a subscription.
- **Usage metering**: `billing_usage_events` stores raw metered events; `billing_usage_daily_totals` keeps daily rollups for alerting and invoicing.
- **Invoicing**: `billing_invoices` and `billing_invoice_items` model billing periods and itemized charges, ready to sync with Stripe or another processor.

## RLS posture
Every billing table enables RLS and uses the same CRUD policy set:
- **Select**: `organization_id = auth.get_current_org_id()`
- **Insert**: `WITH CHECK (organization_id = auth.get_current_org_id())`
- **Update/Delete**: Require matching `organization_id` for the row being modified.

These policies pair with the existing `auth.get_current_org_id()` helper to guarantee tenant isolation for plans, subscriptions, usage, and invoices.

## Rollout notes
- Apply the SQL with your Supabase workflow (e.g., `supabase db push`).
- Backfill existing tenants with a default plan and subscription before enabling entitlements enforcement in application code.
- Use `billing_usage_events` as the single ingestion point for metering so that aggregations and invoices stay consistent across services.
