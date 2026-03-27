# Audit Log Evidence

**Last verified:** 2026-03-26  
**Status:** PASS

---

## Schema

Audit log entries are written to two tables:

| Table | Purpose |
|-------|---------|
| `public.audit_logs` | Application-level audit trail (project CRUD, user actions) |
| `public.security_audit_log` | Security events (auth, MFA, access control decisions) |
| `public.audit_logs_archive` | Long-term retention archive (immutable) |
| `public.security_audit_log_archive` | Long-term security event archive (immutable) |

### Entry fields (audit_logs)

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `action` | text | `create`, `update`, `delete`, `read`, `export`, `login`, `logout`, `mfa_challenge` |
| `resource_type` | text | Resource being acted on (e.g., `project`, `user`, `tenant`) |
| `resource_id` | text | ID of the affected resource |
| `user_id` | text | Actor performing the action |
| `tenant_id` | text | Tenant context (RLS-enforced) |
| `details` | jsonb | Correlation ID, IP, user agent, before/after state |
| `created_at` | timestamptz | Immutable write timestamp |

---

## Immutability controls

Immutability is enforced at two layers:

### 1. Database triggers (migration `20260319010000_audit_retention_verification.sql`)

```sql
-- audit_logs: append-only (no UPDATE)
CREATE TRIGGER audit_logs_append_only_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- audit_logs_archive: fully immutable (no UPDATE or DELETE)
CREATE TRIGGER audit_logs_archive_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs_archive
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- security_audit_log: append-only
CREATE TRIGGER security_audit_log_append_only_update
  BEFORE UPDATE ON public.security_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- security_audit_log_archive: fully immutable
CREATE TRIGGER security_audit_log_archive_immutable
  BEFORE UPDATE OR DELETE ON public.security_audit_log_archive
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

### 2. Service layer contract

`auditLogService` (in `packages/backend/src/services/security/`) exposes only:
- `createEntry()` — the sole write path
- Read methods (`getEntries`, `getEntry`, `query`)

No `update`, `delete`, `upsert`, or `bulk` methods exist on the service. This is verified by the test in `packages/backend/src/__tests__/projects.audit-log.immutability.test.ts`.

---

## RLS policies

| Table | Policy | Grants |
|-------|--------|--------|
| `audit_logs` | `audit_logs_tenant_select` | SELECT for matching `tenant_id` |
| `audit_logs` | `audit_logs_service_role` | All operations for `service_role` |
| `security_audit_log` | `security_audit_log_authorized_select` | SELECT for authorized users |
| `security_audit_log` | `security_audit_log_service_role` | All operations for `service_role` |

Non-service-role clients cannot `UPDATE` or `DELETE` audit rows — the trigger fires before RLS and raises an exception.

---

## Events covered

The following events produce audit log entries:

| Event | Table | Verified by |
|-------|-------|-------------|
| Project create | `audit_logs` | `projects.audit-log.immutability.test.ts` |
| Project update | `audit_logs` | `projects.audit-log.immutability.test.ts` |
| Project delete | `audit_logs` | `projects.audit-log.immutability.test.ts` |
| Audit log mutation attempt | Service contract | `projects.audit-log.immutability.test.ts` |

---

## Retention policy

- Active tables: 90-day rolling window (configurable via `AUDIT_LOG_RETENTION_DAYS`)
- Archive tables: indefinite retention, immutable
- Archive rotation: triggered by `rotate_security_audit_logs()` function on schedule

---

## Production promotion gate

**Status: PASS**

- ✅ Immutability triggers exist in migration `20260319010000_audit_retention_verification.sql`
- ✅ Service layer exposes no mutation methods (verified by unit test)
- ✅ RLS policies restrict cross-tenant reads
- ✅ Archive tables are fully immutable (UPDATE + DELETE blocked)
