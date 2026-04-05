# Infisical Secrets Management Integration

**Last Updated**: 2026-03-21

---

## Overview

ValueOS integrates [Infisical](https://infisical.com) as a secrets management backend alongside AWS Secrets Manager and HashiCorp Vault. Infisical provides centralized, end-to-end encrypted secret storage with native multi-tenant isolation via folder-based secret paths.

The integration implements the `ISecretProvider` interface, ensuring all three backends are interchangeable and can operate together through the `FallbackSecretProvider` for high availability.

### Key Capabilities

- **Multi-tenant isolation**: Secrets are organized under `/tenants/{tenantId}/` folder paths within a single Infisical project, enabling RBAC restrictions per tenant.
- **Universal Auth**: Authentication uses Machine Identity (client ID + client secret) with automatic token caching and pre-expiry refresh.
- **Encrypted caching**: In-memory cache with AES-GCM encryption via `SecretCacheCrypto`, preventing plaintext secrets in memory.
- **Circuit breaker**: All Infisical API calls are wrapped in a circuit breaker (5-failure threshold, 30 s recovery) to prevent cascading failures.
- **Audit logging**: Every read, write, rotate, delete, and list operation is logged to the structured audit trail via `StructuredSecretAuditLogger`.
- **Fallback support**: Infisical can serve as primary, secondary, or tertiary provider in the fallback chain.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Application Code                        │
│              provider.getSecret(tenantId, key)                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   FallbackSecretProvider                      │
│         primary → fallback1 → fallback2 (configurable)       │
└──┬──────────────────┬──────────────────┬─────────────────────┘
   │                  │                  │
   ▼                  ▼                  ▼
┌──────────┐   ┌──────────────┐   ┌────────────────┐
│   AWS    │   │  HashiCorp   │   │   Infisical    │
│ Secrets  │   │    Vault     │   │   Provider     │
│ Manager  │   │              │   │                │
└──────────┘   └──────────────┘   └───────┬────────┘
                                          │
                                ┌─────────┴─────────┐
                                │  CircuitBreaker    │
                                ├────────────────────┤
                                │  SecretCacheCrypto │
                                ├────────────────────┤
                                │  InputValidator    │
                                ├────────────────────┤
                                │  AuditLogger       │
                                └─────────┬──────────┘
                                          │
                                          ▼
                                ┌────────────────────┐
                                │  Infisical API v3  │
                                │  (REST over HTTPS) │
                                └────────────────────┘
```

### Tenant Isolation Model

Secrets are stored in a flat Infisical project with folder-based tenant scoping:

```
Project: valueos-secrets
Environment: prod (or staging, dev)
│
├── /tenants/org-acme/
│   ├── DATABASE_URL
│   ├── STRIPE_SECRET_KEY
│   └── OPENAI_API_KEY
│
├── /tenants/org-globex/
│   ├── DATABASE_URL
│   ├── TWILIO_AUTH_TOKEN
│   └── OPENAI_API_KEY
│
└── /shared/              (future: cross-tenant shared secrets)
    └── SYSTEM_SIGNING_KEY
```

Every API call includes the `secretPath=/tenants/{tenantId}` parameter. Infisical's folder-level RBAC can restrict Machine Identities to specific paths, enforcing server-side tenant boundaries.

---

## Configuration

### Environment Variables

| Variable                       | Required           | Default                     | Description                                      |
| ------------------------------ | ------------------ | --------------------------- | ------------------------------------------------ |
| `SECRETS_PROVIDER`             | No                 | `aws`                       | Primary provider: `aws`, `vault`, or `infisical` |
| `INFISICAL_SITE_URL`           | Yes (if infisical) | `https://app.infisical.com` | Infisical instance URL (self-hosted or cloud)    |
| `INFISICAL_CLIENT_ID`          | Yes (if infisical) | —                           | Machine Identity client ID                       |
| `INFISICAL_CLIENT_SECRET`      | Yes (if infisical) | —                           | Machine Identity client secret                   |
| `INFISICAL_PROJECT_ID`         | Yes (if infisical) | —                           | Infisical project ID                             |
| `INFISICAL_ENVIRONMENT`        | No                 | Value of `NODE_ENV`         | Environment slug (`dev`, `staging`, `prod`)      |
| `SECRETS_CACHE_TTL`            | No                 | `300000`                    | Cache TTL in milliseconds (default 5 min)        |
| `SECRETS_FALLBACK_ENABLED`     | No                 | `true`                      | Enable automatic fallback to other providers     |
| `CACHE_ENCRYPTION_KEY`         | No                 | —                           | AES key for encrypting cached secrets in memory  |
| `CACHE_ENCRYPTION_KEY_VERSION` | No                 | —                           | Version identifier for the cache encryption key  |

All variables are defined in [ops/env/.env.base](../../ops/env/.env.base).

### Minimal Setup

> ⚠️ **Never paste real secrets into docs, chat, tickets, or commits.** Use invalid placeholders or secret-manager paths only.

```bash
# .env or environment
SECRETS_PROVIDER=infisical
INFISICAL_SITE_URL=https://app.infisical.com
INFISICAL_CLIENT_ID=sm://valueos/prod/infisical/client_id
INFISICAL_CLIENT_SECRET=sm://valueos/prod/infisical/client_secret
INFISICAL_PROJECT_ID=sm://valueos/prod/infisical/project_id
INFISICAL_ENVIRONMENT=prod
```

### Fallback Configuration

When `SECRETS_FALLBACK_ENABLED=true` (default), the `ProviderFactory` automatically registers non-primary providers as fallbacks if their credentials are present:

```bash
# Primary: Infisical, fallback to AWS then Vault
SECRETS_PROVIDER=infisical
INFISICAL_CLIENT_ID=sm://valueos/prod/infisical/client_id
INFISICAL_CLIENT_SECRET=sm://valueos/prod/infisical/client_secret
INFISICAL_PROJECT_ID=sm://valueos/prod/infisical/project_id

# AWS fallback (auto-detected from AWS_REGION)
AWS_REGION=us-east-1

# Vault fallback (auto-detected from VAULT_ADDR)
VAULT_ADDR=https://vault.internal:8200
VAULT_NAMESPACE=valuecanvas
```

Fallback order: primary → other providers in the order AWS → Vault → Infisical (whichever are not the primary and have credentials configured).

---

## Implementation Reference

### Source Files

| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| `packages/backend/src/config/secrets/InfisicalSecretProvider.ts` | Provider implementation                      |
| `packages/backend/src/config/secrets/ISecretProvider.ts`         | Provider interface and shared types          |
| `packages/backend/src/config/secrets/ProviderFactory.ts`         | Factory with Infisical support               |
| `packages/backend/src/config/secrets/SecretConfig.ts`            | Centralized config loader                    |
| `packages/backend/src/config/secrets/FallbackSecretProvider.ts`  | Multi-provider fallback chain                |
| `packages/backend/src/config/secrets/SecretCacheCrypto.ts`       | Encrypted in-memory cache                    |
| `packages/backend/src/config/secrets/InputValidator.ts`          | Input validation and sanitization            |
| `packages/backend/src/config/secrets/SecretAuditLogger.ts`       | Structured audit logging                     |
| `scripts/security/verify-secret-rotation.mjs`                    | CI rotation verification (Infisical support) |
| `.github/workflows/secret-rotation-verification.yml`             | Rotation CI workflow                         |
| `ops/env/.env.base`                                              | Env var reference                            |

### ISecretProvider Interface

The `InfisicalSecretProvider` implements the full `ISecretProvider` contract:

| Method                                               | Description                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getSecret(tenantId, key, version?, userId?)`        | Retrieve a secret. Checks encrypted cache first, then calls Infisical API v3.  |
| `setSecret(tenantId, key, value, metadata, userId?)` | Create or update a secret. Auto-detects create vs. update.                     |
| `rotateSecret(tenantId, key, userId?)`               | Generate a new cryptographically random value and replace the existing secret. |
| `deleteSecret(tenantId, key, userId?)`               | Remove a secret from Infisical and invalidate cache.                           |
| `listSecrets(tenantId, userId?)`                     | List all secret keys under a tenant's folder path.                             |
| `getSecretMetadata(tenantId, key, userId?)`          | Retrieve version and path metadata without the secret value.                   |
| `secretExists(tenantId, key, userId?)`               | Check existence without retrieving the value.                                  |
| `healthCheck()`                                      | Verify Infisical connectivity by authenticating.                               |
| `clearCache(tenantId?)`                              | Purge cached secrets (all or per-tenant).                                      |

### Authentication Flow

```
1. First API call triggers authenticate()
2. POST /api/v1/auth/universal-auth/login
   Body: { clientId, clientSecret }
   Response: { accessToken, expiresIn, tokenType }
3. Token cached in memory until (expiresIn - 60s)
4. Subsequent calls reuse cached token
5. Token auto-refreshes 60 seconds before expiry
```

### API Endpoints Used

| Method | Endpoint                            | Usage                  |
| ------ | ----------------------------------- | ---------------------- |
| POST   | `/api/v1/auth/universal-auth/login` | Authentication         |
| GET    | `/api/v3/secrets/raw/{secretKey}`   | Read a secret          |
| POST   | `/api/v3/secrets/raw/{secretKey}`   | Create a secret        |
| PATCH  | `/api/v3/secrets/raw/{secretKey}`   | Update a secret        |
| DELETE | `/api/v3/secrets/raw/{secretKey}`   | Delete a secret        |
| GET    | `/api/v3/secrets/raw`               | List secrets in a path |

All API calls include query parameters: `workspaceId`, `environment`, `secretPath`.

---

## Resilience

### Circuit Breaker

The circuit breaker protects the application from cascading failures when Infisical is unreachable:

| Parameter         | Value                  |
| ----------------- | ---------------------- |
| Failure threshold | 5 consecutive failures |
| Recovery timeout  | 30 seconds             |
| Monitoring period | 60 seconds             |
| Success threshold | 3 successes to close   |

When open, API calls fail fast without contacting Infisical. The `FallbackSecretProvider` then routes to the next available backend.

### Encrypted Cache

Secrets returned from Infisical are cached in an encrypted in-memory `Map`:

- Encryption: AES-256-GCM via `SecretCacheCrypto`
- AAD (Additional Authenticated Data): `infisical:{tenantId}:{secretKey}`
- TTL: Configurable via `SECRETS_CACHE_TTL` (default 5 minutes)
- Key versioning: Supports rotation of the cache encryption key via `CACHE_ENCRYPTION_KEY_VERSION`

Cache is automatically invalidated on write, rotate, and delete operations.

---

## Audit Trail

Every operation is logged through `StructuredSecretAuditLogger`:

| Event            | Fields Logged                                                      |
| ---------------- | ------------------------------------------------------------------ |
| READ (cache hit) | tenantId, secretKey, userId, source=cache, latency_ms              |
| READ (API fetch) | tenantId, secretKey, userId, source=infisical, version, latency_ms |
| WRITE            | tenantId, secretKey, userId, sensitivityLevel                      |
| ROTATE           | tenantId, secretKey, userId                                        |
| DELETE           | tenantId, secretKey, userId                                        |
| LIST             | tenantId, count                                                    |
| FAILURE          | tenantId, secretKey, userId, error message                         |

Failed operations are logged as denied access with the error reason.

---

## CI/CD Integration

### Secret Rotation Verification

The `secret-rotation-verification.yml` workflow validates that secrets have been rotated within policy thresholds. Infisical support requires these GitHub Actions variables/secrets:

| GitHub Setting                           | Type     | Value                          |
| ---------------------------------------- | -------- | ------------------------------ |
| `SECRET_ROTATION_INFISICAL_SITE_URL`     | Variable | Infisical instance URL         |
| `SECRET_ROTATION_INFISICAL_TOKEN`        | Secret   | Machine Identity token         |
| `SECRET_ROTATION_INFISICAL_PROJECT_ID`   | Variable | Project identifier             |
| `SECRET_ROTATION_INFISICAL_ENVIRONMENT`  | Variable | Environment slug               |
| `SECRET_ROTATION_INFISICAL_SECRET_PATHS` | Variable | Comma-separated paths to check |

The rotation verification script (`scripts/security/verify-secret-rotation.mjs`) auto-detects Infisical when `INFISICAL_SITE_URL` is set and queries secret metadata to verify rotation compliance.

---

## Testing

### Unit Tests

Located at `packages/backend/src/config/secrets/__tests__/InfisicalSecretProvider.test.ts` — **18 tests** covering:

| Test Group        | Cases                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Authentication    | First request triggers auth, token reuse on subsequent calls, auth failure handling |
| getSecret         | Fetches from API, uses correct tenant path, caches responses, validates input       |
| listSecrets       | Returns secret keys for a tenant folder                                             |
| setSecret         | Creates new secrets via POST                                                        |
| deleteSecret      | Removes secrets and invalidates cache                                               |
| healthCheck       | Returns true on successful auth, false on failure                                   |
| Provider identity | Returns `"infisical"` from `getProviderName()`                                      |
| Cache management  | `clearCache()` for all tenants, `clearCache(tenantId)` for one tenant               |
| Tenant isolation  | Different tenants use different folder paths                                        |

### Compliance Tests

Located at `packages/backend/src/config/secrets/__tests__/providerCompliance.test.ts` — shared test suite verifying all three providers (AWS, Vault, Infisical) meet the `ISecretProvider` contract:

- Caching behavior (second read uses cache, not API)
- Secret listing per tenant
- Correct provider name reporting

### Running Tests

```bash
# Run Infisical unit tests only
pnpm test -- --testNamePattern="InfisicalSecretProvider"

# Run compliance tests for all providers
pnpm test -- --testNamePattern="ISecretProvider compliance"

# Run all secrets tests
pnpm test -- packages/backend/src/config/secrets/
```

---

## Infisical Setup Guide

### 1. Create a Project

In the Infisical dashboard (cloud or self-hosted), create a project for ValueOS (e.g., `valueos-secrets`).

### 2. Configure Environments

Create environments matching your deployment stages:

- `dev` — local development
- `staging` — pre-production
- `prod` — production

### 3. Create Folder Structure

For each tenant, create a folder under `/tenants/`:

```
/tenants/org-acme/
/tenants/org-globex/
```

Secrets created via the `setSecret()` API automatically use the correct folder path.

### 4. Create a Machine Identity

1. Navigate to **Project Settings → Machine Identities**
2. Create a new identity with **Universal Auth** method
3. Note the `Client ID` and `Client Secret`
4. Assign the identity access to the environments and folder paths it needs

### 5. Configure RBAC (Recommended)

Restrict the Machine Identity to only the `/tenants/` path prefix and the specific environment. This enforces server-side tenant isolation even if application-level checks are bypassed:

| Permission    | Scope                     |
| ------------- | ------------------------- |
| Read secrets  | `/tenants/*` in `prod`    |
| Write secrets | `/tenants/*` in `prod`    |
| No access     | `/` (root) or other paths |

### 6. Set Environment Variables

Populate the environment variables listed in the [Configuration](#configuration) section in your deployment target (Kubernetes secrets, GitHub Actions secrets, `.env` files for local development).

---

## Security Considerations

- **Credentials at rest**: `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` should be stored in a secure location (e.g., Kubernetes secrets, CI/CD secret store) and never committed to source control.
- **Network**: All communication with Infisical uses HTTPS. For self-hosted instances, ensure TLS is properly configured.
- **Token lifetime**: Access tokens are cached and refreshed 60 seconds before expiry. The token is held only in process memory and is never persisted to disk or cache.
- **Cache encryption**: When `CACHE_ENCRYPTION_KEY` is set, cached secret values are encrypted with AES-256-GCM. Without this key, secrets are still held only in process memory but in plaintext.
- **Input validation**: All tenant IDs and secret keys are validated and sanitized through `InputValidator` before use in API paths, preventing path traversal and injection attacks.
- **Audit completeness**: Both successful and failed operations are logged, supporting incident investigation and compliance evidence.

---

## Related Documentation

- [Security Overview](./security-overview.md) — Security controls matrix
- [Compliance Guide](./compliance-guide.md) — SOC 2 / ISO27001 / GDPR compliance mappings
- [Production Contract](./production-contract.md) — Production requirements for secrets
- [Architecture Overview](../architecture/architecture-overview.md) — System architecture
- [Deployment Guide](../operations/deployment-guide.md) — Deployment procedures including secrets configuration
- [Secret Key Transition Runbook](../operations/secret-key-transition-runbook.md) — Runbook for rotating secret encryption keys
