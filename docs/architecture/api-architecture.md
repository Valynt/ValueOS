---
title: Api Architecture
owner: team-platform
system: valueos-platform
---

# Api Architecture

**Last Updated**: 2026-02-08

**Consolidated from 3 source documents**

---

## Table of Contents

1. [Value Modeling API Reference](#value-modeling-api-reference)
2. [API Changelog Template](#api-changelog-template)
3. [API Versioning Policy](#api-versioning-policy)

---

## Canonical OpenAPI Source of Truth

The canonical machine-readable API contract is `packages/backend/openapi.yaml`. CI validates this file for structural correctness and enforces a single OpenAPI document root.

## Value Modeling API Reference

*Source: `engineering/api/VALUE_MODELING_API.md`*

REST API endpoints for managing value cases and value drivers.

## Base URL

```
/api/v1
```

All endpoints require authentication via JWT bearer token. See [API Versioning Policy](./API_VERSIONING_POLICY.md) for version negotiation.

## Authentication

Include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

All requests include a correlation ID for tracing:
- Request header: `X-Correlation-ID` (optional, auto-generated if not provided)
- Response includes: `requestId` in JSON body

## Rate Limiting

| Tier | Limit | Applies To |
|------|-------|------------|
| Standard | 100 req/min | GET operations |
| Strict | 20 req/min | POST, DELETE operations |

Rate limit headers returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Value Cases

Value cases represent customer value propositions with ROI calculations.

### Roles

| Operation | Required Roles |
|-----------|---------------|
| Create | `admin`, `member` |
| Read | `admin`, `member`, `viewer` |
| Update | `admin`, `member` |
| Delete | `admin` |

### Create Value Case

```
POST /api/v1/cases
```

**Request Body:**

```json
{
  "name": "string (required, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "status": "draft | active | archived (default: draft)",
  "industry": "string (optional)",
  "companySize": "string (optional)",
  "targetPersona": "string (optional)",
  "estimatedValue": "number (optional, >= 0)",
  "currency": "string (optional, 3-char ISO code)",
  "tags": ["string"] (optional),
  "metadata": {} (optional)
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "string",
    "description": "string",
    "status": "draft",
    "industry": "string",
    "companySize": "string",
    "targetPersona": "string",
    "estimatedValue": 50000,
    "currency": "USD",
    "tags": ["roi", "enterprise"],
    "metadata": {},
    "createdBy": "uuid",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  },
  "requestId": "req-uuid"
}
```

### List Value Cases

```
GET /api/v1/cases
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status |
| `industry` | string | Filter by industry |
| `search` | string | Search in name/description |
| `sortBy` | string | Sort field (default: createdAt) |
| `sortOrder` | string | `asc` or `desc` (default: desc) |

**Response:** `200 OK`

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "requestId": "req-uuid"
}
```

### Get Value Case

```
GET /api/v1/cases/:caseId
```

**Response:** `200 OK`

```json
{
  "data": { ... },
  "requestId": "req-uuid"
}
```

### Update Value Case

```
PATCH /api/v1/cases/:caseId
```

**Request Body:** Same fields as create, all optional.

**Response:** `200 OK`

### Delete Value Case

```
DELETE /api/v1/cases/:caseId
```

**Response:** `204 No Content`

---

## Value Drivers

Value drivers define reusable calculation formulas for ROI modeling.

### Roles

| Operation | Required Roles |
|-----------|---------------|
| Create | `admin` |
| Read (published) | `admin`, `member`, `viewer` |
| Read (draft) | `admin` |
| Update | `admin` |
| Delete | `admin` |
| Track Usage | `admin`, `member` |

### Create Value Driver

```
POST /api/v1/drivers
```

**Request Body:**

```json
{
  "name": "string (required, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "category": "string (required)",
  "status": "draft | published | archived (default: draft)",
  "formula": {
    "expression": "string (required, valid formula)",
    "variables": [
      {
        "name": "string",
        "type": "number | currency | percentage",
        "defaultValue": "number (optional)"
      }
    ],
    "outputType": "number | currency | percentage"
  },
  "personaTags": ["string"] (optional, valid persona identifiers),
  "industryTags": ["string"] (optional),
  "metadata": {} (optional)
}
```

**Formula Expression Syntax:**

Supported operators: `+`, `-`, `*`, `/`, `(`, `)`

Variables referenced by name: `{revenue} * {margin} / 100`

**Response:** `201 Created`

### List Value Drivers

```
GET /api/v1/drivers
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status (non-admin forced to `published`) |
| `category` | string | Filter by category |
| `personaTag` | string | Filter by persona tag |
| `search` | string | Search in name/description |
| `sortBy` | string | Sort field (default: createdAt) |
| `sortOrder` | string | `asc` or `desc` (default: desc) |

**Response:** `200 OK`

### Get Value Driver

```
GET /api/v1/drivers/:driverId
```

Non-admin users receive `404` for non-published drivers.

**Response:** `200 OK`

### Update Value Driver

```
PATCH /api/v1/drivers/:driverId
```

**Request Body:** Same fields as create, all optional.

**Response:** `200 OK`

### Delete Value Driver

```
DELETE /api/v1/drivers/:driverId
```

**Response:** `204 No Content`

### Track Driver Usage

```
POST /api/v1/drivers/:driverId/usage
```

Increments usage counter for analytics.

**Response:** `204 No Content`

---

## Error Responses

All errors return a consistent structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": { ... },
  "requestId": "req-uuid"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body or parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `SERVICE_UNAVAILABLE` | 503 | Database temporarily unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Validation Error Details

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": {
    "errors": [
      { "field": "name", "message": "Required" },
      { "field": "formula.expression", "message": "Invalid formula syntax" }
    ]
  },
  "requestId": "req-uuid"
}
```

---

## Multi-Tenancy

All endpoints are tenant-scoped. The tenant ID is extracted from the authenticated user's JWT claims. Cross-tenant access is prevented at the database level via row-level security (RLS).

---

## Examples

### Create a Value Driver

```bash
curl -X POST https://api.valueos.io/api/v1/drivers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Annual Cost Savings",
    "category": "cost-reduction",
    "status": "published",
    "formula": {
      "expression": "{hours_saved} * {hourly_rate} * 52",
      "variables": [
        { "name": "hours_saved", "type": "number", "defaultValue": 10 },
        { "name": "hourly_rate", "type": "currency", "defaultValue": 75 }
      ],
      "outputType": "currency"
    },
    "personaTags": ["operations", "finance"]
  }'
```

### List Published Drivers with Filtering

```bash
curl "https://api.valueos.io/api/v1/drivers?category=cost-reduction&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## API Changelog Template

*Source: `engineering/api/API_CHANGELOG_TEMPLATE.md`*

Use this template to document releases, highlight breaking changes, and track deprecations.

## [vX.Y.Z] - YYYY-MM-DD

### Added

- ...

### Changed

- ...

### Fixed

- ...

### Deprecated

- ...
- Planned removal date (minimum 90 days): ...
- Migration guidance: ...

### Removed

- ...
- Client impact and remediation steps: ...

### Security

- ...

### Notes

- `API-Version` header value: ...
- `API-Deprecated-Versions` header value: ...
- Links to SDK docs / examples: ...

---

## API Versioning Policy

*Source: `engineering/api/API_VERSIONING_POLICY.md`*

## Scope and API classes

- **Public APIs**: externally consumed APIs, SDK-facing routes, and any endpoint documented for customers or partners.
- **Internal APIs**: service-to-service and platform-internal endpoints not exposed as customer contracts.

## SemVer policy by API class

### Public APIs

- **MAJOR**: breaking contract changes (removed endpoint, removed/renamed required field, stricter validation, removed status code).
- **MINOR**: additive non-breaking changes (new endpoint, optional request fields, additive response fields).
- **PATCH**: implementation fixes with no contract changes.
- Breaking changes require a new API version (for example, `v2`), a migration guide, and at least 90 days of overlap support unless a security exception is approved.

### Internal APIs

- Internal APIs may evolve faster but must still use backward-compatible changes within a release train.
- Planned breaking changes require owner approval and release notes in platform changelog entries.
- Internal consumers must pin to explicit versions and validate in pre-production before rollout.

## Compatibility and deprecation requirements

- OpenAPI contract checks in CI gate pull requests against `scripts/openapi.yaml`.
- Deprecations must include replacement guidance, announced removal date, and impact notes for client teams.
- Deprecated versions expose deprecation metadata headers until removal deadline.

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

---