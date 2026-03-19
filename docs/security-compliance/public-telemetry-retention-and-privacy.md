# Public Telemetry Retention and Privacy Standard

**Last Updated**: 2026-03-19

---

## Purpose

This standard covers the unauthenticated browser telemetry accepted by `POST /api/analytics/web-vitals` and `POST /api/analytics/performance`. It is intentionally separate from tenant-scoped product analytics so operational telemetry can be governed with tighter abuse, privacy, and retention controls.

## Scope

Applies to:

- Core Web Vitals submissions from browsers.
- Browser performance events sent to the public analytics ingestion endpoints.
- Derived operational summaries used for reliability, abuse monitoring, and frontend performance investigations.

Does **not** apply to:

- Authenticated tenant product analytics.
- Value loop analytics stored under tenant context.
- Customer behavior reporting, adoption reporting, or business intelligence exports.

## Data Minimization Rules

Public telemetry ingestion MUST:

- Accept only schema-validated payloads with strict field allowlists.
- Reject unexpected fields, invalid types, and oversized strings.
- Cap string lengths for URLs, user agents, metric names, and event types.
- Avoid logging raw client-supplied URL, referrer, IP, or user-agent values.
- Prefer hashed or truncated derived identifiers when operational debugging requires request correlation.
- Exclude query strings, tokens, cookies, and arbitrary request-body blobs from logs.

## Logging and Privacy Handling

For public telemetry events:

- **IP addresses**: retain only short-lived network logs required by the platform edge; application logs should store only hashed request IP values.
- **User agents**: store only hashed user-agent fingerprints in application logs unless a temporary incident exception is approved.
- **URLs and referrers**: do not log raw full URLs from the browser. Log only hashed URL/referrer-derived values needed for deduplication or abuse triage.
- **Event payloads**: log only validated low-cardinality fields such as metric name, event type, rounded numeric values, and timestamp.

## Retention

Retention for public telemetry is distinct from product analytics:

- **Application logs containing public telemetry metadata**: 30 days.
- **Aggregated operational summaries or dashboards derived from public telemetry**: 30 days unless a shorter on-call investigation window is sufficient.
- **Temporary incident exports**: delete within 7 days after the incident review unless legal hold applies.
- **Raw request captures for abuse investigations**: disabled by default; if temporarily enabled, retain no longer than 72 hours and require incident ticket linkage.

Product analytics retention follows its own product and customer-data policy and must not inherit the public telemetry exceptions above.

## Access Control

- Limit public telemetry access to platform engineering, security, and on-call responders with observability access.
- Treat any request to join public telemetry with customer-identifying datasets as a privacy review trigger.
- Do not expose public telemetry raw feeds to customer-facing analytics surfaces.

## Ingestion Hardening Guidance

Deployments SHOULD enable at least one browser-ingestion control:

1. **Dedicated ingestion token** via `PUBLIC_TELEMETRY_INGESTION_TOKEN`, sent by the browser as `x-telemetry-key`.
2. **Origin allowlist** via `PUBLIC_TELEMETRY_ALLOWED_ORIGINS`, restricting telemetry submission to approved first-party origins.

Recommended production posture is to use **both** controls together so the browser telemetry path is origin-bound and separately revocable from other public APIs.

## Abuse Testing Expectations

Coverage for public telemetry routes MUST include:

- Oversized payload rejection.
- Invalid primitive and object type rejection.
- Unexpected-field rejection.
- Log-injection strings in metric names and event types.
- Cache invalidation safety when tenant headers are spoofed.

## Review Cadence

Review this standard whenever:

- Public telemetry fields change.
- Browser telemetry is routed to a new sink.
- Retention or privacy controls change.
- Product analytics and public telemetry boundaries are revisited.
