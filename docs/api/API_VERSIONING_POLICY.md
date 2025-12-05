# API Versioning Policy

## Supported Strategies
- **URL versioning (preferred):** Prefix routes with `/api/v1/...`.
- **Header versioning:** Provide `X-API-Version: v1` or `Accept-Version: v1` when calling `/api/...`.
- **Default behavior:** Requests without an explicit version are routed to `v1`.

## Current Lifecycle
- **Current:** `v1`
- **Default:** `v1`
- **Deprecated:** None (deprecation headers will be added when versions sunset).

## Failure Behavior
- Requests targeting unsupported versions return **426 Upgrade Required** with guidance and the current stable version in the `API-Version` response header.

## Deprecation Timelines
- New versions will be announced at least **90 days** before deprecation.
- Deprecation notices will be documented in the API changelog and surfaced via the `API-Deprecated-Versions` header.
- Breaking removals will not occur before the published deadline and will include migration notes for affected endpoints.

## Migration Expectations
- Use the URL prefix (`/api/v1/...`) for forward compatibility.
- When using header-based versioning, always send `X-API-Version` to avoid implicit rollbacks when defaults change.
- Clients should read the `API-Version` response header and log it for troubleshooting.
