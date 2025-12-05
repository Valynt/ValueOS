# Multi-Tenant Isolation Tests

## Purpose
Multi-tenant SaaS applications must guarantee strict isolation between tenants. These tests validate that:
- **Data isolation:** Tenants cannot access each other’s data.
- **Authorization boundaries:** Tenant-scoped roles stay confined to their tenant.
- **Resource partitioning:** Configuration, rate limits, and settings are applied per tenant.
- **Edge-case safety:** Crafted tenant identifiers or misconfigured headers cannot bypass isolation.

## Test Categories

### A. Data Access Isolation
- Querying with Tenant A’s auth token only returns Tenant A’s records.
- Cross-tenant ID injection attempts (e.g., fetching `tenantB.resource_id`) are rejected.
- Bulk queries (pagination, filtering) never leak another tenant’s data.
- Unique constraints (such as `tenant_id + email`) enforce per-tenant scoping.

### B. Authentication & Authorization
- Tenant admins can manage only their own tenant’s users.
- Global admins can view across tenants, but tenant admins cannot.
- Malformed or missing `X-Tenant-ID` headers are rejected.
- Mismatches between token payload `tenant_id` and header `tenant_id` result in denial.

### C. Configuration & Metadata
- Tenant-specific settings (branding, limits, features) do not overlap.
- Update requests with an incorrect `tenant_id` cannot override other tenants’ configs.
- Deleting a tenant does not affect unrelated tenants.

### D. Security Boundary Tests
- SQL/Cypher injection attempts using crafted `tenant_id` strings fail safely.
- APIs that join multiple tables consistently enforce `tenant_id` joins.
- Background jobs, queues, and caches remain scoped by `tenant_id`.

### E. Side-Channel & System Tests
- File storage (S3, GCS, etc.) enforces tenant-scoped prefixes.
- Logs and monitoring never expose another tenant’s data.
- Rate limiting and quotas apply per tenant, not globally.

## Example Test Snippets

### Jest + Supertest (Node.js)
```javascript
it("should prevent cross-tenant data access", async () => {
  const res = await request(app)
    .get(`/api/v1/resources/${tenantBResourceId}`)
    .set("Authorization", `Bearer ${tenantAToken}`)
    .set("X-Tenant-ID", "tenantA");

  expect(res.status).toBe(403);
});
```

### Pytest (FastAPI)
```python
def test_cross_tenant_forbidden(client, tenant_a_token, tenant_b_resource):
    response = client.get(
        f"/resources/{tenant_b_resource.id}",
        headers={
            "Authorization": f"Bearer {tenant_a_token}",
            "X-Tenant-ID": "tenantA",
        },
    )
    assert response.status_code == 403
```

## Automation & Coverage
- Run these tests in CI/CD pipelines with seeded data for multiple tenants.
- Include negative tests (malformed headers, SQLi payloads, missing `tenant_id`).
- Add pentest or fuzz scripts targeting `tenant_id` boundary cases.
