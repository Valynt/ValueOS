# Engineering: API & Service Architecture

## 1. External API Endpoints

ValueOS provides a RESTful API for lifecycle orchestration and telemetry.

### Core Endpoints

- `POST /v1/lifecycle/runs`: Trigger a workflow (Discovery, Modeling, Realization, Expansion).
- `GET /v1/docs/pages/{slug}`: Fetch documentation with versioning.
- `POST /v1/telemetry/events`: Ingest KPI metrics for value realization.

### Security

- **Auth**: Bearer tokens via Supabase GoTrue.
- **Scopes**: `lifecycle:trigger`, `docs:read`, `telemetry:write`.
- **Webhooks**: HMAC-SHA256 signed payloads for async event notifications.

## 2. Internal Service Infrastructure

All services extend `BaseService` for consistent behavior:

- **Resilience**: Exponential backoff retries.
- **Performance**: Request deduplication and TTL-based caching.
- **Errors**: Standardized `ServiceError` hierarchy.

### Key Services

- **AuthService**: Manages sessions and masquerading.
- **PermissionService**: RBAC implementation (User → Role → Permission).
- **AuditLogService**: Immutable logging of sensitive operations.
- **SettingsService**: Scoped configuration (User, Team, Org).

## 3. Event-Driven Patterns

For complex, long-running agentic tasks, ValueOS uses:

- **Kafka**: Message broker for `agent-requests` and `agent-responses`.
- **Saga Pattern**: Orchestrates multi-step workflows with compensation logic for failures.
- **WebSocket**: Real-time streaming of agent state and progress.

---

**Last Updated:** 2026-01-28
**Related:** `docs/engineering/ENGINEERING_MASTER.md`, `src/services/`
