# Secrets Management Guide

**Version:** 1.0.0  
**Last Updated:** 2026-01-04  
**Status:** Production Ready

---

## Overview

This guide documents the secrets management strategy for the ValueOS dev container. Proper secrets management is critical for security and prevents credential exposure.

### Key Principles

1. **Never commit secrets to git**
2. **Use environment-specific secret storage**
3. **Rotate secrets regularly**
4. **Limit secret access to minimum required**
5. **Audit secret usage**

---

## Quick Start

### For New Developers

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill in your secrets (get from team lead or secret manager)
nano .env

# 3. Setup Docker secrets (optional but recommended)
bash .devcontainer/scripts/setup-secrets.sh

# 4. Verify secrets are not tracked by git
git status  # .env should not appear

# 5. Load secrets in your shell
source .devcontainer/load-secrets.sh
```

### For Existing Developers

If you already have secrets in `.env`, migrate to Docker secrets:

```bash
# Run setup script (extracts from .env)
bash .devcontainer/scripts/setup-secrets.sh

# Verify secrets created
ls -la .devcontainer/secrets/

# Optional: Remove secrets from .env (keep non-sensitive config)
```

---

## Secret Types

### 1. Development Secrets (Low Security)

**Storage:** `.env` file (gitignored)  
**Use Case:** Local development only  
**Examples:**
- `VITE_APP_URL`
- `LOG_LEVEL`
- `VITE_HMR_ENABLED`

**Setup:**
```bash
# .env file
VITE_APP_URL=http://localhost:5173
LOG_LEVEL=debug
```

### 2. Sensitive Secrets (Medium Security)

**Storage:** Docker secrets or environment variables  
**Use Case:** Development and staging  
**Examples:**
- `JWT_SECRET`
- `DB_PASSWORD`
- `REDIS_PASSWORD`

**Setup:**
```bash
# Using Docker secrets
echo -n "your-jwt-secret" > .devcontainer/secrets/jwt_secret.txt
chmod 600 .devcontainer/secrets/jwt_secret.txt

# Or using .env (less secure)
JWT_SECRET=your-jwt-secret
```

### 3. Critical Secrets (High Security)

**Storage:** External secret manager (Vault, AWS Secrets Manager)  
**Use Case:** Production only  
**Examples:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOGETHER_API_KEY`
- `SUPABASE_ACCESS_TOKEN`

**Setup:**
```bash
# Development: Use Docker secrets
bash .devcontainer/scripts/setup-secrets.sh

# Production: Use external secret manager
# See "Production Secrets" section below
```

---

## Implementation Methods

### Method 1: Environment Variables (.env file)

**Pros:**
- Simple to use
- Works everywhere
- Easy to update

**Cons:**
- Less secure (plaintext file)
- Can be accidentally committed
- No audit trail

**Setup:**

1. Create `.env` file:
```bash
cp .env.example .env
```

2. Add secrets:
```bash
# .env
SUPABASE_ACCESS_TOKEN=sbp_your_token_here
JWT_SECRET=your-jwt-secret-here
TOGETHER_API_KEY=your-api-key-here
DB_PASSWORD=your-db-password
REDIS_PASSWORD=your-redis-password
```

3. Verify gitignore:
```bash
grep "^\.env$" .gitignore  # Should return .env
```

4. Load in application:
```typescript
// Node.js
const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN;

// Vite (client-side, use VITE_ prefix)
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

### Method 2: Docker Secrets (Recommended)

**Pros:**
- More secure (file-based, restricted permissions)
- Explicit secret management
- Works with Docker Compose and Swarm
- Audit trail possible

**Cons:**
- Slightly more complex setup
- Requires Docker Compose or Swarm
- Not available in all environments

**Setup:**

1. Run setup script:
```bash
bash .devcontainer/scripts/setup-secrets.sh
```

2. Verify secrets created:
```bash
ls -la .devcontainer/secrets/
# Should show:
# -rw------- supabase_token.txt
# -rw------- jwt_secret.txt
# -rw------- together_api_key.txt
# -rw------- db_password.txt
# -rw------- redis_password.txt
```

3. Use with Docker Compose:
```bash
# Start with secrets
docker-compose -f .devcontainer/docker-compose.secrets.yml up -d
```

4. Access in container:
```bash
# Secrets mounted at /run/secrets/
cat /run/secrets/supabase_token

# Or load into environment
source .devcontainer/load-secrets.sh
echo $SUPABASE_ACCESS_TOKEN
```

5. Use in application:
```typescript
// Read from file
import { readFileSync } from 'fs';

const tokenFile = process.env.SUPABASE_ACCESS_TOKEN_FILE || '/run/secrets/supabase_token';
const token = readFileSync(tokenFile, 'utf8').trim();

// Or use pre-loaded environment variable
const token = process.env.SUPABASE_ACCESS_TOKEN;
```

### Method 3: External Secret Manager (Production)

**Pros:**
- Highest security
- Centralized management
- Audit logging
- Automatic rotation
- Access control

**Cons:**
- Complex setup
- Requires external service
- Additional cost
- Network dependency

**Supported Services:**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager
- Doppler
- 1Password Secrets Automation

**Setup Example (AWS Secrets Manager):**

1. Store secret in AWS:
```bash
aws secretsmanager create-secret \
    --name valuecanvas/dev/supabase-token \
    --secret-string "sbp_your_token_here"
```

2. Grant access:
```bash
# Attach policy to IAM role/user
aws iam attach-role-policy \
    --role-name valuecanvas-dev \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

3. Retrieve in application:
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString || '';
}

// Usage
const token = await getSecret('valuecanvas/dev/supabase-token');
```

---

## Secret Inventory

### Required Secrets

| Secret | Type | Storage | Rotation | Description |
|--------|------|---------|----------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Critical | Docker Secrets | 90 days | Supabase Management API token |
| `JWT_SECRET` | Sensitive | Docker Secrets | 180 days | JWT signing secret |
| `TOGETHER_API_KEY` | Critical | Docker Secrets | 90 days | Together.ai API key |
| `DB_PASSWORD` | Sensitive | Docker Secrets | 90 days | PostgreSQL password |
| `REDIS_PASSWORD` | Sensitive | Docker Secrets | 90 days | Redis password |

### Optional Secrets

| Secret | Type | Storage | Description |
|--------|------|---------|-------------|
| `SMTP_PASSWORD` | Sensitive | Docker Secrets | Email service password |
| `S3_ACCESS_KEY` | Sensitive | Docker Secrets | AWS S3 access key |
| `S3_SECRET_KEY` | Critical | Docker Secrets | AWS S3 secret key |
| `SENTRY_DSN` | Development | .env | Sentry error tracking DSN |
| `DATADOG_API_KEY` | Sensitive | Docker Secrets | Datadog monitoring key |

---

## Secret Rotation

### Rotation Schedule

- **Critical Secrets:** Every 90 days
- **Sensitive Secrets:** Every 180 days
- **Development Secrets:** As needed

### Rotation Process

1. **Generate new secret:**
```bash
# Example: Generate new JWT secret
openssl rand -base64 64
```

2. **Update secret storage:**
```bash
# Docker secrets
echo -n "new-secret-value" > .devcontainer/secrets/jwt_secret.txt

# Or update in secret manager
aws secretsmanager update-secret \
    --secret-id valuecanvas/dev/jwt-secret \
    --secret-string "new-secret-value"
```

3. **Update application:**
```bash
# Restart container to load new secret
docker-compose restart

# Or reload secrets
source .devcontainer/load-secrets.sh
```

4. **Verify new secret works:**
```bash
# Test application functionality
curl -H "Authorization: Bearer $NEW_TOKEN" http://localhost:8000/health
```

5. **Revoke old secret:**
```bash
# Revoke in service dashboard (Supabase, Together.ai, etc.)
```

6. **Document rotation:**
```bash
# Update rotation log
echo "$(date -Iseconds) - JWT_SECRET rotated" >> .devcontainer/secrets/rotation.log
```

---

## Security Best Practices

### DO ✅

1. **Use strong secrets:**
```bash
# Generate cryptographically secure secrets
openssl rand -base64 32  # 32 bytes = 256 bits
```

2. **Set restrictive permissions:**
```bash
chmod 600 .devcontainer/secrets/*.txt  # Owner read/write only
chmod 700 .devcontainer/secrets/       # Owner access only
```

3. **Verify gitignore:**
```bash
# Check .env is ignored
git check-ignore .env  # Should return .env

# Check secrets directory is ignored
git check-ignore .devcontainer/secrets/jwt_secret.txt  # Should return path
```

4. **Use environment-specific secrets:**
```bash
# Development
SUPABASE_URL=https://dev-project.supabase.co

# Production
SUPABASE_URL=https://prod-project.supabase.co
```

5. **Audit secret access:**
```bash
# Log secret access
echo "$(date -Iseconds) - Secret accessed by $USER" >> /var/log/secret-access.log
```

### DON'T ❌

1. **Never commit secrets:**
```bash
# BAD - hardcoded secret
const API_KEY = "sbp_4d0537d35652d74db73f08ea849883070e8e9a21";

# GOOD - from environment
const API_KEY = process.env.SUPABASE_ACCESS_TOKEN;
```

2. **Never log secrets:**
```bash
# BAD
console.log("Token:", process.env.SUPABASE_ACCESS_TOKEN);

# GOOD
console.log("Token:", process.env.SUPABASE_ACCESS_TOKEN ? "***SET***" : "***NOT SET***");
```

3. **Never share secrets in plain text:**
```bash
# BAD - email, Slack, etc.
# GOOD - use secret sharing service (1Password, LastPass)
```

4. **Never use weak secrets:**
```bash
# BAD
JWT_SECRET=secret123

# GOOD
JWT_SECRET=$(openssl rand -base64 64)
```

5. **Never reuse secrets across environments:**
```bash
# BAD - same secret for dev and prod
# GOOD - different secrets per environment
```

---

## Troubleshooting

### Secret Not Found

**Problem:** Application can't find secret

**Solutions:**

1. Check secret file exists:
```bash
ls -la .devcontainer/secrets/
```

2. Check file permissions:
```bash
stat .devcontainer/secrets/jwt_secret.txt
# Should be: -rw------- (600)
```

3. Check environment variable:
```bash
echo $SUPABASE_ACCESS_TOKEN
# Should print token or be empty
```

4. Load secrets manually:
```bash
source .devcontainer/load-secrets.sh
```

### Secret Not Loading

**Problem:** Secret file exists but not loaded

**Solutions:**

1. Check file has no trailing newline:
```bash
# View file with special characters
cat -A .devcontainer/secrets/jwt_secret.txt
# Should NOT end with $ (newline)
```

2. Recreate secret file:
```bash
echo -n "your-secret-value" > .devcontainer/secrets/jwt_secret.txt
```

3. Check Docker secrets mount:
```bash
docker exec valuecanvas-dev-optimized ls -la /run/secrets/
```

### Secret Accidentally Committed

**Problem:** Secret committed to git

**Solutions:**

1. **IMMEDIATE:** Revoke the secret in service dashboard

2. Remove from current commit:
```bash
git reset HEAD .env
git checkout -- .env
```

3. Remove from git history:
```bash
bash .devcontainer/scripts/remove-secrets.sh
```

4. Force push (coordinate with team):
```bash
git push --force --all origin
```

5. Rotate secret immediately

---

## Migration Guide

### From .env to Docker Secrets

1. **Backup current .env:**
```bash
cp .env .env.backup
```

2. **Run migration script:**
```bash
bash .devcontainer/scripts/setup-secrets.sh
```

3. **Verify secrets created:**
```bash
ls -la .devcontainer/secrets/
```

4. **Update docker-compose:**
```bash
# Use secrets-enabled compose file
docker-compose -f .devcontainer/docker-compose.secrets.yml up -d
```

5. **Test application:**
```bash
# Verify secrets loaded
docker exec valuecanvas-dev-optimized env | grep -E "SUPABASE|JWT|TOGETHER"
```

6. **Remove secrets from .env (optional):**
```bash
# Keep non-sensitive config in .env
# Remove sensitive values
nano .env
```

### From Hardcoded to Environment Variables

1. **Find hardcoded secrets:**
```bash
# Search for potential secrets
grep -r "sbp_" src/
grep -r "eyJ" src/ | grep -v node_modules
```

2. **Replace with environment variables:**
```typescript
// Before
const token = "sbp_4d0537d35652d74db73f08ea849883070e8e9a21";

// After
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  throw new Error('SUPABASE_ACCESS_TOKEN not set');
}
```

3. **Add to .env.example:**
```bash
echo "SUPABASE_ACCESS_TOKEN=your-token-here" >> .env.example
```

4. **Update documentation:**
```markdown
## Required Environment Variables

- `SUPABASE_ACCESS_TOKEN` - Get from Supabase dashboard
```

---

## Production Secrets

### AWS Secrets Manager

```typescript
// Load secrets at startup
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function loadSecrets() {
  const secrets = await Promise.all([
    getSecret('valuecanvas/prod/supabase-token'),
    getSecret('valuecanvas/prod/jwt-secret'),
    getSecret('valuecanvas/prod/together-api-key'),
  ]);
  
  process.env.SUPABASE_ACCESS_TOKEN = secrets[0];
  process.env.JWT_SECRET = secrets[1];
  process.env.TOGETHER_API_KEY = secrets[2];
}

// Call at application startup
await loadSecrets();
```

### HashiCorp Vault

```typescript
import vault from 'node-vault';

const client = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

async function loadSecrets() {
  const result = await client.read('secret/data/valuecanvas/prod');
  const secrets = result.data.data;
  
  process.env.SUPABASE_ACCESS_TOKEN = secrets.supabase_token;
  process.env.JWT_SECRET = secrets.jwt_secret;
  process.env.TOGETHER_API_KEY = secrets.together_api_key;
}
```

### Kubernetes Secrets

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: valuecanvas-secrets
type: Opaque
stringData:
  supabase-token: sbp_your_token_here
  jwt-secret: your-jwt-secret-here
  together-api-key: your-api-key-here
```

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: valuecanvas
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: SUPABASE_ACCESS_TOKEN
          valueFrom:
            secretKeyRef:
              name: valuecanvas-secrets
              key: supabase-token
```

---

## Compliance and Audit

### Audit Log

Track secret access and rotation:

```bash
# .devcontainer/secrets/audit.log
2026-01-04T10:00:00Z - Secret created: supabase_token
2026-01-04T10:00:01Z - Secret accessed by: vscode
2026-01-04T10:30:00Z - Secret rotated: jwt_secret
```

### Compliance Requirements

- **PCI DSS:** Encrypt secrets at rest and in transit
- **HIPAA:** Audit all secret access
- **SOC 2:** Implement secret rotation policy
- **GDPR:** Document secret handling procedures

### Regular Audits

```bash
# Monthly secret audit
bash .devcontainer/scripts/audit-secrets.sh

# Check for:
# - Expired secrets
# - Weak secrets
# - Unused secrets
# - Secrets in git history
# - Improper permissions
```

---

## References

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [NIST Special Publication 800-57](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

---

## Support

**Questions?** Contact the security team or refer to:
- [SECURITY_INCIDENT_REPORT.md](./SECURITY_INCIDENT_REPORT.md) - Incident response procedures
- [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md) - Security enhancements
- [REVIEW_SUMMARY.md](./REVIEW_SUMMARY.md) - Security review findings

---

**Document Version:** 1.0.0  
**Last Review:** 2026-01-04  
**Next Review:** 2026-04-04
