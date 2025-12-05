---
trigger: always_on
---

# Backend Services

**Path:** `src/services/*`

- Services must NOT hold state between requests
- Always use `supabase.auth.getUser()` context
- Bypass RLS with `service_role` ONLY for: AuthService, TenantProvisioning, CronJobs
- Multi-table writes in SQL transactions (via RPC)
