# Notification Preference Resolution

This document defines how notification preferences are resolved across defaults, tenant configuration, user settings, and per-notification runtime overrides.

## Resolution Goals

- Produce one deterministic final preference set for each `(user, eventType, channel)` decision.
- Keep backend, frontend, and admin UX aligned on identical precedence and fallback behavior.
- Make missing or malformed data safe by default, observable, and recoverable.

## Precedence Hierarchy

Preference layers are evaluated from lowest to highest priority:

1. **System default** (platform-wide baseline)
2. **Tenant default** (organization baseline)
3. **User override** (recipient-specific preference)
4. **Per-notification override** (runtime, send-time override for a specific notification)

**Rule:** later layers overwrite earlier layers for the same key.

### Effective Resolution Formula

For a single key:

```text
effective = system
effective = merge(effective, tenant)
effective = merge(effective, user)
effective = merge(effective, notification)
```

Where `merge(a, b)` applies only valid keys from `b` and leaves `a` unchanged for missing/invalid keys.

## Data Model Concepts

Implementations should normalize all layers to this shape before merge:

```json
{
  "channels": {
    "email": { "enabled": true },
    "sms": { "enabled": false },
    "push": { "enabled": true },
    "in_app": { "enabled": true }
  },
  "event_types": {
    "invoice.overdue": {
      "channels": {
        "email": { "enabled": true },
        "sms": { "enabled": false }
      }
    }
  }
}
```

- `channels.*` is **channel-level** preference (global across event types).
- `event_types.<event>.channels.*` is **event-type-level** preference (specific exception for one event type).

## Channel-Level vs Event-Type-Level Conflict Resolution

Within a resolved layer set, apply this order:

1. Resolve global channel setting from precedence hierarchy.
2. Resolve event-specific channel setting from precedence hierarchy.
3. If event-specific setting exists and is valid, it **wins** for that `(eventType, channel)` pair.
4. Otherwise, use the channel-level setting.

### Practical Interpretation

- Channel-level is the default for every event.
- Event-type-level is a scoped exception.
- A higher-priority channel-level setting can still be superseded by a lower-priority event-specific setting **only if** that event-specific value survives precedence at its own key path.

Example:

- User sets `channels.email.enabled=false`.
- Tenant sets `event_types.invoice.overdue.channels.email.enabled=true`.
- Since user layer is higher than tenant, user global false remains unless user (or notification) also sets event-specific value.
- If user sets `event_types.invoice.overdue.channels.email.enabled=true`, then overdue invoice email is enabled while other email events remain disabled.

## Missing or Malformed Preference Records

### Missing Records

- Missing tenant record: behave as empty object, rely on system defaults.
- Missing user record: behave as empty object, rely on system+tenant.
- Missing event type block: fallback to channel-level result.
- Missing channel key in any layer: no-op for that merge step.

### Malformed Records

A value is malformed if type/schema is incorrect (e.g., `enabled: "yes"`, unknown channel object shape, non-object `event_types`).

Behavior:

1. Ignore malformed field only (do not discard whole record unless root is unreadable).
2. Log a structured warning with tenant/user/record identifiers.
3. Increment an observability metric (`notifications_pref_malformed_total`).
4. Continue resolving using lower-priority valid data.

### Safe Defaults for Malformed Cases

- If all layers for a key are missing/malformed, use **system default**.
- If system default is unavailable (unexpected config error), fail closed for external channels (`email`, `sms`, `push`) and allow `in_app` only, while emitting high-severity alert.

## Migration and Defaulting Strategy

For existing tenants/users during rollout:

1. **Introduce versioned schema** (`preference_schema_version=1`).
2. **Backfill tenant defaults**:
   - Create explicit tenant records from current platform behavior.
   - Keep values identical to previous behavior to avoid surprise.
3. **Backfill user overrides lazily or in batches**:
   - If a user had no prior custom preference, store no explicit user record (sparse model).
   - If prior custom data exists, transform to v1 schema.
4. **Dual-read period**:
   - Read new schema first; fallback to legacy schema mapping while migration is incomplete.
5. **Write-forward**:
   - All new writes use v1 schema only.
6. **Cutover and cleanup**:
   - Remove legacy read path after migration SLO is met.

### Migration Guardrails

- Idempotent migration jobs.
- Per-tenant checkpointing.
- Dry-run mode with diff output.
- Audit log entries for bulk preference writes.

## Truth Table (Representative Scenarios)

Assumptions for table:

- System defaults: `email=true`, `sms=false`, `push=true`, `in_app=true`.
- Evaluated target is one `(eventType, channel)` pair per row.
- `—` means not set in that layer.

| # | Event Type | Channel | System | Tenant | User | Notification | Event-Specific Inputs | Effective | Reason |
|---|------------|---------|--------|--------|------|--------------|-----------------------|-----------|--------|
| 1 | invoice.overdue | email | true | — | — | — | none | **true** | System default only |
| 2 | invoice.overdue | email | true | false | — | — | none | **false** | Tenant overrides system |
| 3 | invoice.overdue | email | true | false | true | — | none | **true** | User overrides tenant |
| 4 | invoice.overdue | email | true | false | true | false | none | **false** | Per-notification overrides user |
| 5 | invoice.overdue | sms | false | — | true | — | none | **true** | User enables channel otherwise disabled |
| 6 | invoice.overdue | email | true | — | false | — | user event-specific `true` | **true** | Event-specific beats same-layer global |
| 7 | invoice.overdue | email | true | true | false | — | tenant event-specific `false` | **false** | User global false (higher layer) + no higher event override |
| 8 | invoice.overdue | email | true | true | false | — | user event-specific `true` | **true** | User event-specific exception |
| 9 | security.alert | push | true | — | — | — | tenant event-specific `false` | **false** | Event-specific fallback from tenant |
| 10 | security.alert | push | true | — | — | true | tenant event-specific `false` | **true** | Notification override is highest |
| 11 | weekly.digest | email | true | malformed (`"off"`) | — | — | none | **true** | Malformed ignored; system retained |
| 12 | weekly.digest | sms | false | — | malformed (`enabled: "yes"`) | — | none | **false** | Malformed ignored; falls back to system |

## Implementation Alignment Notes

### Backend

- Resolve preferences server-side for authoritative send decisions.
- Return resolved explanation metadata (`source_layer`, `event_specific_applied`) for debugging.

### Frontend

- Display both channel default and event-specific exception state.
- Warn users when they are creating an exception that differs from channel-level baseline.

### Admin

- Tenant admin controls should edit tenant layer only.
- Provide preview tool: “View effective preference as user X for event Y”.
- Surface malformed-record warnings in admin diagnostics.

## Suggested Pseudocode

```ts
function resolveEnabled(ctx): boolean {
  const merged = mergeAllValid([
    ctx.system,
    ctx.tenant,
    ctx.user,
    ctx.notification,
  ]);

  const channelLevel = merged.channels?.[ctx.channel]?.enabled;
  const eventLevel = merged.event_types?.[ctx.eventType]?.channels?.[ctx.channel]?.enabled;

  if (isBoolean(eventLevel)) return eventLevel;
  if (isBoolean(channelLevel)) return channelLevel;

  return getSystemSafeDefault(ctx.channel);
}
```
