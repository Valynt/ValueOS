# Custom Domains Database Schema

**Version:** 1.0  
**Migration:** `20251208164354_custom_domains.sql`  
**Status:** Ready for deployment

---

## Overview

The custom domains schema enables tenants to add and verify custom domains for their organization. It supports DNS verification, automatic SSL certificate provisioning via Caddy, and comprehensive audit logging.

---

## Tables

### `custom_domains`

Stores custom domains for tenant organizations with verification and SSL status.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization that owns this domain |
| `domain` | TEXT | NOT NULL, UNIQUE, CHECK (domain format) | The custom domain (e.g., app.acme.com) |
| `verified` | BOOLEAN | DEFAULT FALSE | Whether domain ownership has been verified |
| `verification_token` | TEXT | NOT NULL, CHECK (length >= 32) | Token for DNS/HTTP verification |
| `verification_method` | TEXT | NOT NULL, CHECK IN ('dns', 'http') | Verification method used |
| `ssl_status` | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'active', 'failed', 'expired') | SSL certificate status |
| `ssl_issued_at` | TIMESTAMPTZ | NULL | When SSL certificate was issued |
| `ssl_expires_at` | TIMESTAMPTZ | NULL | When SSL certificate expires |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When domain was added |
| `verified_at` | TIMESTAMPTZ | NULL | When domain was verified |
| `last_checked_at` | TIMESTAMPTZ | NULL | Last verification check |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

#### Indexes

- `idx_custom_domains_tenant_id` - Fast tenant lookups
- `idx_custom_domains_domain` - Fast domain lookups
- `idx_custom_domains_verified` - Partial index on verified domains
- `idx_custom_domains_ssl_expires` - Partial index for certificate expiration monitoring

#### Constraints

- **Domain Format:** Must match regex `^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$`
- **Verification Token:** Minimum 32 characters
- **Unique Domain:** Each domain can only be claimed once

#### Triggers

- `custom_domains_updated_at` - Automatically updates `updated_at` on row changes

---

### `domain_verification_logs`

Audit log of all domain verification attempts for troubleshooting and compliance.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `domain_id` | UUID | NOT NULL, REFERENCES custom_domains(id) ON DELETE CASCADE | Domain being verified |
| `tenant_id` | UUID | NOT NULL, REFERENCES organizations(id) ON DELETE CASCADE | Organization that owns the domain |
| `verification_method` | TEXT | NOT NULL, CHECK IN ('dns', 'http') | Verification method used |
| `status` | TEXT | NOT NULL, CHECK IN ('success', 'failed', 'pending') | Verification result |
| `error_message` | TEXT | NULL | Error message if verification failed |
| `dns_records` | JSONB | NULL | DNS records found during verification |
| `http_response` | JSONB | NULL | HTTP response during verification |
| `checked_at` | TIMESTAMPTZ | DEFAULT NOW() | When verification was attempted |
| `user_agent` | TEXT | NULL | User agent of requester |
| `ip_address` | INET | NULL | IP address of requester |
| `request_id` | TEXT | NULL | Request ID for tracing |

#### Indexes

- `idx_domain_verification_logs_domain_id` - Fast domain lookups
- `idx_domain_verification_logs_tenant_id` - Fast tenant lookups
- `idx_domain_verification_logs_checked_at` - Chronological queries
- `idx_domain_verification_logs_status` - Status filtering

---

## Row Level Security (RLS)

### `custom_domains` Policies

#### SELECT Policy: "Tenants can view own domains"
```sql
tenant_id IN (
    SELECT id FROM organizations
    WHERE id = auth.uid()
    OR id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    )
)
```
**Effect:** Users can only view domains belonging to their organization(s).

#### INSERT Policy: "Tenants can insert own domains"
```sql
tenant_id IN (
    SELECT id FROM organizations
    WHERE id = auth.uid()
    OR id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
)
```
**Effect:** Only owners and admins can add domains.

#### UPDATE Policy: "Tenants can update own domains"
**Effect:** Only owners and admins can update their organization's domains.

#### DELETE Policy: "Tenants can delete own domains"
**Effect:** Only owners and admins can delete their organization's domains.

#### Service Role Policy: "Service role can access all domains"
```sql
auth.role() = 'service_role'
```
**Effect:** Domain validator service can query all domains.

### `domain_verification_logs` Policies

#### SELECT Policy: "Tenants can view own verification logs"
**Effect:** Users can view verification logs for their organization's domains.

#### INSERT Policy: "Service role can insert verification logs"
**Effect:** Only the service role can create verification logs.

#### Service Role Policy: "Service role can access all logs"
**Effect:** Service role has full access for logging and auditing.

---

## Helper Functions

### `log_domain_verification()`

Logs a domain verification attempt.

**Signature:**
```sql
log_domain_verification(
    p_domain_id UUID,
    p_tenant_id UUID,
    p_verification_method TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_dns_records JSONB DEFAULT NULL,
    p_http_response JSONB DEFAULT NULL
) RETURNS UUID
```

**Usage:**
```sql
SELECT log_domain_verification(
    'domain-uuid',
    'tenant-uuid',
    'dns',
    'success',
    NULL,
    '{"records": ["TXT verification-token"]}'::jsonb,
    NULL
);
```

**Returns:** UUID of the created log entry.

---

## Usage Examples

### Add a Custom Domain

```sql
INSERT INTO custom_domains (
    tenant_id,
    domain,
    verification_token,
    verification_method
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'app.acme.com',
    'abcdef1234567890abcdef1234567890abcdef',
    'dns'
);
```

### Verify a Domain

```sql
UPDATE custom_domains
SET 
    verified = TRUE,
    verified_at = NOW(),
    last_checked_at = NOW()
WHERE 
    id = 'domain-uuid'
    AND tenant_id = 'tenant-uuid';
```

### Update SSL Status

```sql
UPDATE custom_domains
SET 
    ssl_status = 'active',
    ssl_issued_at = NOW(),
    ssl_expires_at = NOW() + INTERVAL '90 days'
WHERE 
    id = 'domain-uuid';
```

### Query Domains Needing Certificate Renewal

```sql
SELECT 
    id,
    domain,
    ssl_expires_at
FROM custom_domains
WHERE 
    ssl_status = 'active'
    AND ssl_expires_at < NOW() + INTERVAL '30 days'
ORDER BY ssl_expires_at ASC;
```

### View Verification History

```sql
SELECT 
    dvl.checked_at,
    dvl.status,
    dvl.error_message,
    dvl.dns_records
FROM domain_verification_logs dvl
JOIN custom_domains cd ON cd.id = dvl.domain_id
WHERE 
    cd.domain = 'app.acme.com'
ORDER BY dvl.checked_at DESC
LIMIT 10;
```

---

## Migration

### Apply Migration

```bash
# Local development
npx supabase db push

# Staging
npx supabase db push --linked

# Production
npx supabase db push --linked --project-ref <prod-ref>
```

### Test Migration

```bash
# Run automated tests
bash scripts/test-custom-domains-migration.sh
```

### Rollback

```bash
# Apply rollback migration
psql $DATABASE_URL -f supabase/migrations/20251208164500_rollback_custom_domains.sql
```

---

## Security Considerations

### Domain Verification

- **Token Length:** Minimum 32 characters prevents brute force
- **Verification Methods:** DNS (TXT record) or HTTP (file upload)
- **Rate Limiting:** Limit verification attempts to prevent abuse
- **Token Expiration:** Tokens should expire after 7 days

### Tenant Isolation

- **RLS Policies:** Enforce tenant boundaries at database level
- **Service Role:** Only domain validator service has cross-tenant access
- **Audit Logging:** All verification attempts logged for compliance

### SSL Certificates

- **Certificate Storage:** Caddy stores certificates in persistent volumes
- **Expiration Monitoring:** Alert 30 days before expiration
- **Automatic Renewal:** Caddy handles renewal automatically

---

## Monitoring

### Key Metrics

- **Domains Added:** Track growth rate
- **Verification Success Rate:** Target > 95%
- **SSL Certificate Issuance Time:** Target < 2 minutes
- **Certificate Expiration:** Alert 30 days before

### Queries for Monitoring

```sql
-- Domains added in last 24 hours
SELECT COUNT(*) FROM custom_domains
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Verification success rate (last 7 days)
SELECT 
    COUNT(CASE WHEN status = 'success' THEN 1 END)::float / COUNT(*) * 100 AS success_rate
FROM domain_verification_logs
WHERE checked_at > NOW() - INTERVAL '7 days';

-- Certificates expiring soon
SELECT COUNT(*) FROM custom_domains
WHERE ssl_status = 'active'
AND ssl_expires_at < NOW() + INTERVAL '30 days';

-- Failed verifications (last 24 hours)
SELECT 
    cd.domain,
    dvl.error_message,
    dvl.checked_at
FROM domain_verification_logs dvl
JOIN custom_domains cd ON cd.id = dvl.domain_id
WHERE 
    dvl.status = 'failed'
    AND dvl.checked_at > NOW() - INTERVAL '24 hours'
ORDER BY dvl.checked_at DESC;
```

---

## Troubleshooting

### Domain Verification Fails

1. Check DNS propagation: `dig TXT _valuecanvas-verify.example.com`
2. Review verification logs: Query `domain_verification_logs`
3. Verify token matches: Compare database token with DNS record
4. Check rate limits: Ensure not hitting verification limits

### SSL Certificate Not Issued

1. Verify domain is verified: `verified = TRUE`
2. Check Caddy logs: `docker logs caddy`
3. Verify domain validator service: `curl http://domain-validator:3000/verify?domain=example.com`
4. Check Let's Encrypt rate limits

### RLS Policy Issues

1. Verify user is authenticated: Check `auth.uid()`
2. Verify organization membership: Query `organization_members`
3. Check role permissions: Ensure user has 'owner' or 'admin' role
4. Test with service role: Temporarily use service role to isolate issue

---

## Related Documentation

- [Custom Domains API](../api/domains-api.md)
- [Domain Verification Guide](../user-guides/custom-domains.md)
- [Caddy Configuration](../infrastructure/caddy-configuration.md)
- [RLS Testing Guide](../testing/rls-testing.md)

---

**Last Updated:** 2025-12-08  
**Migration Version:** 20251208164354  
**Status:** ✅ Ready for Deployment
