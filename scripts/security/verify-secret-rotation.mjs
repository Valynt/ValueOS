#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_MAX_AGE_DAYS = 90;
const DEFAULT_EVIDENCE_ROOT = 'evidence/security/rotation';

function parseProviders() {
  const configured = process.env.SECRET_ROTATION_PROVIDERS;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((provider) => provider.trim().toLowerCase())
      .filter(Boolean);
  }

  const inferred = [];
  if (process.env.AWS_SECRET_IDS && process.env.AWS_REGION) {
    inferred.push('aws');
  }
  if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN && process.env.VAULT_SECRET_PATHS) {
    inferred.push('vault');
  }
  if (process.env.INFISICAL_SITE_URL && process.env.INFISICAL_MACHINE_IDENTITY_TOKEN && process.env.INFISICAL_SECRET_PATHS) {
    inferred.push('infisical');
  }
  return inferred;
}

function parseList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTimestamp(value) {
  if (value && value.trim().length > 0) {
    return value.trim().replace(/[^0-9A-Za-z_.-]/g, '-');
  }
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function daysSince(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid metadata timestamp: ${timestamp}`);
  }
  return (Date.now() - date.getTime()) / 86_400_000;
}

function getAwsSecretMetadata(secretId, region) {
  const output = execFileSync(
    'aws',
    ['secretsmanager', 'describe-secret', '--secret-id', secretId, '--region', region, '--output', 'json'],
    { encoding: 'utf8' },
  );

  const parsed = JSON.parse(output);
  const lastRotatedDate = parsed.LastRotatedDate || parsed.LastChangedDate || parsed.CreatedDate;

  if (!lastRotatedDate) {
    throw new Error(`AWS secret ${secretId} did not include LastRotatedDate/LastChangedDate/CreatedDate`);
  }

  return {
    secretId,
    provider: 'aws',
    metadataTimestamp: new Date(lastRotatedDate).toISOString(),
    source: 'aws secretsmanager describe-secret',
  };
}

function requestJson(url, headers) {
  return new Promise((resolvePromise, rejectPromise) => {
    const requestImpl = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requestImpl(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
            rejectPromise(new Error(`HTTP ${response.statusCode}: ${body}`));
            return;
          }
          try {
            resolvePromise(JSON.parse(body));
          } catch (error) {
            rejectPromise(new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      },
    );

    req.on('error', rejectPromise);
    req.end();
  });
}

async function getVaultSecretMetadata(pathname, addr, token, mount) {
  const urlPath = pathname.split('/').map(encodeURIComponent).join('/');
  const metadataUrl = new URL(`${addr.replace(/\/$/, '')}/v1/${mount}/metadata/${urlPath}`);

  let payload;
  try {
    payload = await requestJson(metadataUrl, {
      'X-Vault-Token': token,
      Accept: 'application/json',
    });
  } catch (error) {
    throw new Error(
      `Vault metadata request failed for ${pathname}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const metadataTimestamp = payload?.data?.updated_time || payload?.data?.created_time;

  if (!metadataTimestamp) {
    throw new Error(`Vault secret ${pathname} did not include data.updated_time/data.created_time`);
  }

  return {
    secretId: pathname,
    provider: 'vault',
    metadataTimestamp,
    source: metadataUrl.toString(),
  };
}

async function collectProviderEvidence(provider, maxAgeDays) {
  if (provider === 'aws') {
    const region = process.env.AWS_REGION;
    const secretIds = parseList(process.env.AWS_SECRET_IDS);

    if (!region) {
      throw new Error('AWS provider configured but AWS_REGION is not set.');
    }
    if (secretIds.length === 0) {
      throw new Error('AWS provider configured but AWS_SECRET_IDS is empty.');
    }

    return secretIds.map((secretId) => {
      const metadata = getAwsSecretMetadata(secretId, region);
      const ageDays = daysSince(metadata.metadataTimestamp);
      return {
        ...metadata,
        maxAgeDays,
        ageDays: Number(ageDays.toFixed(2)),
        compliant: ageDays <= maxAgeDays,
      };
    });
  }

  if (provider === 'vault') {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    const mount = process.env.VAULT_KV_MOUNT || 'secret';
    const secretPaths = parseList(process.env.VAULT_SECRET_PATHS);

    if (!addr) {
      throw new Error('Vault provider configured but VAULT_ADDR is not set.');
    }
    if (!token) {
      throw new Error('Vault provider configured but VAULT_TOKEN is not set.');
    }
    if (secretPaths.length === 0) {
      throw new Error('Vault provider configured but VAULT_SECRET_PATHS is empty.');
    }

    const results = [];
    for (const secretPath of secretPaths) {
      const metadata = await getVaultSecretMetadata(secretPath, addr, token, mount);
      const ageDays = daysSince(metadata.metadataTimestamp);
      results.push({
        ...metadata,
        maxAgeDays,
        ageDays: Number(ageDays.toFixed(2)),
        compliant: ageDays <= maxAgeDays,
      });
    }
    return results;
  }

  if (provider === 'infisical') {
    const siteUrl = process.env.INFISICAL_SITE_URL;
    const token = process.env.INFISICAL_MACHINE_IDENTITY_TOKEN;
    const projectId = process.env.INFISICAL_PROJECT_ID;
    const environment = process.env.INFISICAL_ENVIRONMENT || 'prod';
    const secretPaths = parseList(process.env.INFISICAL_SECRET_PATHS);

    if (!siteUrl) {
      throw new Error('Infisical provider configured but INFISICAL_SITE_URL is not set.');
    }
    if (!token) {
      throw new Error('Infisical provider configured but INFISICAL_MACHINE_IDENTITY_TOKEN is not set.');
    }
    if (!projectId) {
      throw new Error('Infisical provider configured but INFISICAL_PROJECT_ID is not set.');
    }
    if (secretPaths.length === 0) {
      throw new Error('Infisical provider configured but INFISICAL_SECRET_PATHS is empty.');
    }

    const results = [];
    for (const secretPath of secretPaths) {
      const metadata = await getInfisicalSecretMetadata(secretPath, siteUrl, token, projectId, environment);
      const ageDays = daysSince(metadata.metadataTimestamp);
      results.push({
        ...metadata,
        maxAgeDays,
        ageDays: Number(ageDays.toFixed(2)),
        compliant: ageDays <= maxAgeDays,
      });
    }
    return results;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function getInfisicalSecretMetadata(secretPath, siteUrl, token, projectId, environment) {
  const parts = secretPath.split('/');
  const secretName = parts.pop();
  const folderPath = parts.join('/') || '/';
  const url = new URL(`${siteUrl.replace(/\/$/, '')}/api/v3/secrets/raw/${encodeURIComponent(secretName)}`);
  url.searchParams.set('workspaceId', projectId);
  url.searchParams.set('environment', environment);
  url.searchParams.set('secretPath', folderPath);

  let payload;
  try {
    payload = await requestJson(url, {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });
  } catch (error) {
    throw new Error(
      `Infisical metadata request failed for ${secretPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const updatedAt = payload?.secret?.updatedAt || payload?.secret?.createdAt;
  if (!updatedAt) {
    throw new Error(`Infisical secret ${secretPath} did not include updatedAt/createdAt`);
  }

  return {
    secretId: secretPath,
    provider: 'infisical',
    metadataTimestamp: new Date(updatedAt).toISOString(),
    source: url.toString(),
  };
}

async function main() {
  const providers = parseProviders();
  const maxAgeDays = Number(process.env.SECRET_ROTATION_MAX_AGE_DAYS || DEFAULT_MAX_AGE_DAYS);

  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error(`SECRET_ROTATION_MAX_AGE_DAYS must be a positive number, received: ${process.env.SECRET_ROTATION_MAX_AGE_DAYS}`);
  }

  if (providers.length === 0) {
    throw new Error(
      'No secret providers configured. Set SECRET_ROTATION_PROVIDERS=aws,vault (or provide provider-specific env vars) to verify rotation metadata age.',
    );
  }

  const timestamp = normalizeTimestamp(process.env.ROTATION_EVIDENCE_TIMESTAMP);
  const evidenceRoot = process.env.ROTATION_EVIDENCE_DIR || DEFAULT_EVIDENCE_ROOT;
  const evidencePath = resolve(evidenceRoot, `${timestamp}.json`);

  const checks = [];
  for (const provider of providers) {
    const providerChecks = await collectProviderEvidence(provider, maxAgeDays);
    checks.push(...providerChecks);
  }

  const nonCompliant = checks.filter((check) => !check.compliant);
  const payload = {
    generatedAt: new Date().toISOString(),
    maxAgeDays,
    providers,
    totalChecks: checks.length,
    nonCompliantChecks: nonCompliant.length,
    checks,
  };

  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Rotation evidence written to ${evidencePath}`);

  if (nonCompliant.length > 0) {
    for (const finding of nonCompliant) {
      console.error(
        `[rotation-noncompliant] provider=${finding.provider} secret=${finding.secretId} ageDays=${finding.ageDays} maxAgeDays=${finding.maxAgeDays}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Secret rotation metadata age check passed (${checks.length} checks, max ${maxAgeDays} days).`);
}

main().catch((error) => {
  console.error(`Secret rotation verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
