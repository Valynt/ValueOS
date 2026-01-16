# Tenant Isolation Recommendation: Postgres RLS + Request Context

## Decision
Adopt **Postgres Row-Level Security (RLS)** with a request-scoped tenant context (`SET LOCAL app.tenant_id`) as the primary tenant isolation mechanism. This gives database-enforced isolation, complements Supabase JWT-based policies, and minimizes ORM-level query mistakes. The implementation uses `security.current_tenant_id()` helpers plus RLS policies and security-barrier views for defense-in-depth. 

## Why RLS for ValueOS
### Environment fit
| Environment factor | RLS Pros | RLS Cons | Notes |
| --- | --- | --- | --- |
| **Serverless** | Stateless and enforced at the DB boundary regardless of app instance. | `SET LOCAL` context must be set per request/transaction; connection reuse requires careful cleanup. | Use request middleware that sets `SET LOCAL app.tenant_id` and releases the connection after the request. |
| **Long-lived services** | Strong isolation even if app code misses tenant filters. | Requires connection pool hygiene to avoid tenant context leakage across requests. | The middleware uses `SET LOCAL` inside a transaction to scope the GUC. |
| **ORM usage** | Avoids “forgotten tenant filter” bugs; ORM queries do not need manual tenant clauses. | ORM-level tests/linters are less effective because isolation happens below the ORM. | Pair with DB RLS tests and security barrier views. |
| **Compliance (SOC2/ISO)** | Clear, auditable isolation at database layer; least-privilege by default. | Requires migration/test discipline to ensure new tables receive RLS policies. | The migration adds policies for all `memory_*` tables with `tenant_id`. |

## Implementation Highlights
1. **Tenant context helpers**  
   Functions `security.current_tenant_id()` and `security.current_tenant_id_uuid()` read `SET LOCAL app.tenant_id` first, then fall back to JWT claims. This supports both server-side transactions and Supabase-authenticated calls.  

2. **RLS policies (SELECT/INSERT/UPDATE/DELETE)**  
   The migration auto-applies policies to all `memory_*` tables with a `tenant_id` column. The `memory_tenants` table has explicit policies keyed on `id = current_tenant_id`.  

3. **Security barrier view**  
   A `security_barrier` view (`security.memory_value_cases_scoped`) provides a safe, tenant-filtered interface that prevents predicate-pushdown issues from leaking cross-tenant data.  

4. **Request middleware**  
   The backend exposes a middleware that starts a transaction, executes `SET LOCAL app.tenant_id = $1`, and ties the connection lifecycle to the request.  

## Operational Notes
* Use the RLS test SQL (`infra/supabase/tests/tenant_rls_isolation.test.sql`) as part of migration validation.
* Keep service-role usage minimal; prefer tenant-scoped connections.
* Add indexes on `(tenant_id, id)` or `(tenant_id, created_at)` in tables with high-volume queries to support RLS performance.
