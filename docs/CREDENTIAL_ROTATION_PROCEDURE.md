# Credential Rotation Procedure

## ⚠️ CRITICAL SECURITY INCIDENT RESPONSE

### Incident: Production Credentials Exposed in Git History

**Date**: 2025-12-31
**Severity**: CRITICAL
**Status**: REMEDIATION IN PROGRESS

---

## Immediate Actions Required

### 1. Rotate Supabase Credentials (IMMEDIATE)

#### Step 1: Generate New Service Role Key
```bash
# Login to Supabase Dashboard
# Navigate to: https://app.supabase.com/project/bxaiabnqalurloblfwua/settings/api
# Click "Reset service_role key"
# Copy new key immediately
```

#### Step 2: Generate New Anon Key
```bash
# In Supabase Dashboard API Settings
# Click "Reset anon key"
# Copy new key immediately
```

#### Step 3: Update Production Environment
```bash
# Update environment variables in production deployment
# DO NOT commit these to git

# For Docker/Kubernetes:
kubectl create secret generic supabase-credentials \
  --from-literal=VITE_SUPABASE_URL=https://bxaiabnqalurloblfwua.supabase.co \
  --from-literal=VITE_SUPABASE_ANON_KEY=<NEW_ANON_KEY> \
  --from-literal=SUPABASE_SERVICE_KEY=<NEW_SERVICE_KEY> \
  --dry-run=client -o yaml | kubectl apply -f -

# For AWS Secrets Manager:
aws secretsmanager update-secret \
  --secret-id valueos/production/supabase \
  --secret-string '{"url":"https://bxaiabnqalurloblfwua.supabase.co","anon_key":"<NEW_ANON_KEY>","service_key":"<NEW_SERVICE_KEY>"}'
```

#### Step 4: Verify New Credentials
```bash
# Test connection with new credentials
curl -X GET 'https://bxaiabnqalurloblfwua.supabase.co/rest/v1/' \
  -H "apikey: <NEW_ANON_KEY>" \
  -H "Authorization: Bearer <NEW_ANON_KEY>"
```

#### Step 5: Revoke Old Credentials
```bash
# In Supabase Dashboard
# Confirm old keys are no longer valid
# Monitor for any failed authentication attempts
```

---

### 2. Remove Credentials from Git History

#### Option A: BFG Repo-Cleaner (Recommended)
```bash
# Install BFG
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror https://github.com/Valynt/ValueOS.git

# Remove .env.production from history
bfg --delete-files .env.production ValueOS.git

# Clean up
cd ValueOS.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (requires admin access)
git push --force
```

#### Option B: git-filter-repo
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove file from history
git filter-repo --path .env.production --invert-paths

# Force push
git push --force --all
```

#### Option C: Manual (if above fail)
```bash
# Remove from current commit
git rm .env.production
git commit -m "security: Remove production credentials from repository"

# Note: This does NOT remove from history
# History cleanup requires force push with admin access
```

---

### 3. Update .gitignore

```bash
# Ensure .env.production is in .gitignore
echo ".env.production" >> .gitignore
git add .gitignore
git commit -m "security: Add .env.production to .gitignore"
```

---

### 4. Implement Secrets Management

#### AWS Secrets Manager Integration
```typescript
// src/config/secrets/aws-secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function getSupabaseCredentials() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  
  const command = new GetSecretValueCommand({
    SecretId: 'valueos/production/supabase',
  });
  
  const response = await client.send(command);
  return JSON.parse(response.SecretString!);
}
```

#### Environment Variable Loading (Development)
```typescript
// src/config/environment.ts
export function loadCredentials() {
  if (process.env.NODE_ENV === 'production') {
    // Load from secrets manager
    return getSupabaseCredentials();
  } else {
    // Load from .env.local (not committed)
    return {
      url: process.env.VITE_SUPABASE_URL,
      anonKey: process.env.VITE_SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_KEY,
    };
  }
}
```

---

## Prevention Measures

### 1. Pre-commit Hooks
```bash
# Install git-secrets
brew install git-secrets

# Initialize in repository
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'SUPABASE.*KEY.*=.*'
git secrets --add 'eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*'
```

### 2. CI/CD Secret Scanning
```yaml
# .github/workflows/security-scan.yml
name: Secret Scanning
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

### 3. Environment File Template
```bash
# .env.production.template
# Copy to .env.production and fill in values
# NEVER commit .env.production

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here
```

### 4. Documentation
```markdown
# docs/DEPLOYMENT.md

## Environment Variables

Production credentials are stored in:
- AWS Secrets Manager: `valueos/production/supabase`
- Kubernetes Secrets: `supabase-credentials`

To update:
1. Rotate keys in Supabase Dashboard
2. Update secrets in AWS/K8s
3. Restart application pods
4. Verify connectivity

NEVER commit credentials to git.
```

---

## Monitoring and Alerting

### 1. Failed Authentication Monitoring
```typescript
// Monitor for authentication failures
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' && !session) {
    logger.warn('Authentication failure detected', {
      timestamp: new Date().toISOString(),
      event,
    });
  }
});
```

### 2. Credential Usage Audit
```sql
-- Query Supabase logs for credential usage
SELECT 
  timestamp,
  request_path,
  status_code,
  user_agent
FROM edge_logs
WHERE status_code = 401
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### 3. Alert Configuration
```typescript
// Alert on suspicious activity
if (failedAuthCount > 10) {
  await sendAlert({
    severity: 'critical',
    message: 'Multiple authentication failures detected',
    details: {
      count: failedAuthCount,
      timeWindow: '5 minutes',
    },
  });
}
```

---

## Verification Checklist

- [ ] New Supabase service_role key generated
- [ ] New Supabase anon key generated
- [ ] Production environment variables updated
- [ ] Old credentials revoked
- [ ] Application connectivity verified
- [ ] .env.production removed from git history
- [ ] .env.production added to .gitignore
- [ ] Pre-commit hooks installed
- [ ] CI/CD secret scanning enabled
- [ ] Secrets manager integration implemented
- [ ] Team notified of credential rotation
- [ ] Documentation updated
- [ ] Monitoring alerts configured

---

## Incident Timeline

| Time | Action | Status |
|------|--------|--------|
| 2025-12-31 00:37 | Credentials discovered in git | ✅ Identified |
| 2025-12-31 00:38 | Execution plan created | ✅ Complete |
| 2025-12-31 00:39 | .gitignore updated | ✅ Complete |
| TBD | Credentials rotated | ⏳ Pending |
| TBD | Git history cleaned | ⏳ Pending |
| TBD | Secrets manager implemented | ⏳ Pending |
| TBD | Monitoring enabled | ⏳ Pending |

---

## Contact Information

**Security Team**: security@valueos.com
**On-Call Engineer**: [Pager Duty]
**Supabase Support**: https://supabase.com/support

---

## References

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

