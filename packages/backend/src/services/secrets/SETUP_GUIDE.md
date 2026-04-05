# Tenant-Safe Secret Layer — Setup Guide

This guide explains how to initialize and configure the newly implemented Tenant-Safe Secret Layer in your local development environment and production.

## 1. Apply Database Migrations

The secret layer introduces two new tables (`tenant_secrets` and `secret_access_audits`) with strict Row Level Security (RLS) policies.

### Local Development (Docker Compose / DevContainer)
If you are running the local Supabase stack via Docker Compose, apply the migration using the Supabase CLI:

```bash
cd infra/supabase
supabase db push
```

### Cloud / Production
If you are deploying to a hosted Supabase instance, ensure your `SUPABASE_ACCESS_TOKEN` is set, then run the provided deployment script:

```bash
cd infra/supabase
./apply-pending-migrations.sh
```

## 2. Configure Encryption Keys

The `SecretBrokerService` relies on the existing `utils/encryption.ts` module to encrypt secrets at rest. You must ensure your environment has a valid Key Encryption Key (KEK) configured.

Add the following to your `.env.local` (for local dev) or your production environment variables:

```env
# Must be a 32-byte key encoded as hex or base64
# Example: generate one with `openssl rand -hex 32`
APP_ENCRYPTION_KEK_MATERIAL=hex:your_32_byte_hex_string_here
APP_ENCRYPTION_KEK_VERSION=1
```

*Note: If you are already using `ENCRYPTION_KEY` or `APP_ENCRYPTION_KEY` for legacy encryption, the system will fall back to it, but migrating to the versioned KEK format is recommended.*

## 3. Provisioning Initial Secrets

Because the system is **deny-by-default**, agents will immediately fail if they attempt to access capabilities that haven't been explicitly provisioned.

You can provision secrets programmatically via the `SecretBrokerService`. Here is an example script you can run in a backend worker or REPL to seed a tenant's secrets:

```typescript
import { getSecretBrokerService } from './services/secrets';

async function seedTenantSecrets(tenantId: string) {
  const broker = getSecretBrokerService();

  await broker.upsertSecret({
    tenantId,
    integration: 'salesforce',
    secretName: 'read',
    plaintextValue: process.env.SALESFORCE_API_KEY || 'dummy-key',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    
    // Explicit Allow-Lists (Deny-by-default)
    allowedAgents: ['value-discovery-agent', 'roi-calculator-agent'],
    allowedTools: ['salesforce_query_tool'],
    allowedPurposes: ['salesforce.read'],
    
    actorId: 'system-provisioner',
  });

  console.log(`Secrets provisioned for tenant ${tenantId}`);
}
```

## 4. Update Tool Executors

Any tool that previously accessed raw environment variables or legacy secret stores must be updated to use the `SecretAwareToolExecutor`.

**Before:**
```typescript
async function handleSalesforceQuery(params) {
  const apiKey = process.env.SALESFORCE_API_KEY; // ❌ Unsafe, not tenant-isolated
  return sfClient.query(params.query, apiKey);
}
```

**After:**
```typescript
import { getSecretAwareToolExecutor } from '../services/secrets';

const executor = getSecretAwareToolExecutor();

// This is typically called by your agent orchestration layer
const result = await executor.execute(
  'salesforce_query_tool',
  [{ capability: 'salesforce.read', purpose: 'salesforce.read' }],
  { query: 'SELECT Id FROM Opportunity' },
  {
    tenantId: currentTenantId,
    agentId: currentAgentId,
    environment: 'development'
  },
  async (params, secrets) => {
    // ✅ Safe: Ephemeral, tenant-isolated, decrypted just-in-time
    const apiKey = secrets['salesforce.read'].decryptedValue;
    return sfClient.query(params.query, apiKey);
  }
);
```

## 5. Verify Audit Logs

Once your agents start executing tools, verify that the immutable audit trail is capturing the decisions.

You can query the database directly:
```sql
SELECT agent_id, capability, tool_name, decision, reason, created_at 
FROM secret_access_audits 
ORDER BY created_at DESC LIMIT 10;
```

Or use the service method:
```typescript
const audits = await broker.getAuditLog(tenantId, { limit: 10 });
console.log(audits);
```

If you see `decision: 'deny'`, check the `reason` column (e.g., `AGENT_NOT_ALLOWED`, `ENVIRONMENT_MISMATCH`) to adjust your provisioning allow-lists.
