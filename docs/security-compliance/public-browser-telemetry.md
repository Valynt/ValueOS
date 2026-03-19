# Public Browser Telemetry Privacy and Retention

This document covers **public browser telemetry** sent to `POST /api/analytics/web-vitals` and `POST /api/analytics/performance`. It is intentionally separate from tenant-scoped product analytics such as Value Loop events.

## Scope separation

- **Public browser telemetry** is operational telemetry used to watch client-side performance, ingestion abuse, and delivery quality.
- **Product analytics** remains tenant-scoped, authenticated, and business-facing. Product analytics retention and access controls should not be inferred from browser telemetry handling.
- Public browser telemetry must never be used as a back door for tenant analytics or identity enrichment.

## Collection rules

The backend accepts only strict, schema-validated payloads for public telemetry:

- Web vitals require a bounded metric name and numeric value.
- Performance events require a bounded event type and a strict, bounded metric detail object.
- Unknown top-level or nested fields are rejected.
- String inputs are capped to reduce abuse and log amplification risk.

## Privacy handling

Public browser telemetry should be treated as **operational metadata**, not user-level analytics.

- Do **not** persist raw request bodies for these endpoints.
- Do **not** log raw IP addresses, full user agents, full referrers, or full URLs.
- If network metadata is needed for abuse detection, log only privacy-reduced derivatives such as:
  - salted hashes of IP addresses;
  - salted hashes of user agents;
  - URL origin plus a hashed path, without query strings or fragments;
  - rounded numeric measurements instead of unbounded raw blobs.
- Avoid joining public telemetry with authenticated user identifiers unless a separate, explicit privacy review approves that linkage.

## Retention policy

Public browser telemetry retention should remain independent from product analytics retention.

- **Raw browser telemetry payloads:** not retained.
- **Structured ingestion/security logs derived from public telemetry:** retain for the minimum operational window needed for abuse investigation and reliability trending; the default target is **14 days** unless a shorter platform-wide log policy applies.
- **Aggregated, non-identifying counters or dashboards:** may be retained longer for operational baselining, provided they do not contain raw identifiers or reconstructable request payloads.
- **Product analytics datasets:** follow their own tenant-scoped retention policy and must not inherit the public telemetry window by default.

## Browser telemetry authentication

Public telemetry should use an ingestion-specific control rather than relying only on anonymous reachability.

Recommended controls:

1. **Dedicated ingestion token** sent in a telemetry-specific header and rotated independently of user auth.
2. **Origin allowlist** for browser-originated telemetry.
3. Optional rate limits or downstream suppression for unexpected cardinality spikes.

If both a telemetry key and origin allowlist are configured, both checks should pass before the payload is accepted.

## Operational review checklist

Before expanding these payloads, confirm:

- the schema remains strict;
- new fields are bounded and privacy-reviewed;
- logging stays hash-based or truncated;
- retention remains documented separately from tenant product analytics;
- abuse tests cover oversized payloads, invalid types, and control-character injection attempts.
