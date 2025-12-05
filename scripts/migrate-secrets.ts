import {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
  CreateSecretCommand,
  PutSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import { StructuredSecretAuditLogger } from '../src/config/secrets/SecretAuditLogger';
import { logger } from '../src/lib/logger';

interface MigrationOptions {
  tenants: string[];
  legacyTenantId: string;
  environment: string;
}

const auditLogger = new StructuredSecretAuditLogger();

function getOptions(): MigrationOptions {
  const tenants = (process.env.MIGRATION_TENANTS || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  return {
    tenants,
    legacyTenantId: process.env.LEGACY_TENANT_ID || 'shared',
    environment: process.env.NODE_ENV || 'development'
  };
}

async function ensureSecret(client: SecretsManagerClient, secretId: string, secretString: string) {
  try {
    await client.send(
      new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: secretString
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name !== 'ResourceNotFoundException') {
      throw error;
    }

    await client.send(
      new CreateSecretCommand({
        Name: secretId,
        SecretString: secretString
      })
    );
  }
}

async function migrateSecret(
  client: SecretsManagerClient,
  secretName: string,
  value: string,
  options: MigrationOptions
) {
  const ownerTenant = extractTenantId(secretName);
  const tenantId =
    ownerTenant && (options.tenants.length === 0 || options.tenants.includes(ownerTenant))
      ? ownerTenant
      : options.legacyTenantId;
  const targetPath = `valuecanvas/${options.environment}/tenants/${tenantId}/config`;

  await ensureSecret(client, targetPath, value);

  await auditLogger.logAccess({
    tenantId,
    secretKey: 'config',
    action: 'WRITE',
    result: 'SUCCESS',
    metadata: { migratedFrom: secretName }
  });
}

function extractTenantId(secretName: string): string | null {
  const tenantTagMatch = secretName.match(/tenants\/(.+?)\//);
  if (tenantTagMatch) {
    return tenantTagMatch[1];
  }
  return null;
}

async function migrate(): Promise<void> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  const options = getOptions();

  const list = await client.send(new ListSecretsCommand({}));
  const secrets = list.SecretList || [];

  for (const secret of secrets) {
    if (!secret.Name || secret.Name.includes('/tenants/')) {
      continue; // already migrated or invalid
    }

    const value = await client.send(
      new GetSecretValueCommand({
        SecretId: secret.Name
      })
    );

    if (!value.SecretString) {
      logger.warn('Skipping empty secret during migration', { secret: secret.Name });
      continue;
    }

    try {
      await migrateSecret(client, secret.Name, value.SecretString, options);
      logger.info('Migrated secret to tenant scope', {
        source: secret.Name,
        environment: options.environment
      });
    } catch (error) {
      await auditLogger.logDenied({
        tenantId: options.legacyTenantId,
        secretKey: 'config',
        action: 'WRITE',
        reason: error instanceof Error ? error.message : String(error)
      });
      logger.error('Failed to migrate secret', error instanceof Error ? error : new Error(String(error)), {
        source: secret.Name
      });
    }
  }
}

migrate().catch(error => {
  logger.error('Migration failed', error instanceof Error ? error : new Error(String(error)));
  process.exitCode = 1;
});
