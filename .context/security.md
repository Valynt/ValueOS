# Security Context

**Last Updated:** 2026-01-08

---

## Overview

ValueOS implements comprehensive security measures across authentication, authorization, data protection, and infrastructure. This document covers security patterns, implementations, and best practices.

---

## Authentication

### Supabase Auth Integration

**Provider:** Supabase Auth (GoTrue)  
**Location:** `src/lib/supabase.ts`, `src/services/AuthService.ts`

**Features:**
- Email/password authentication
- OAuth providers (Google, Apple, GitHub)
- Multi-factor authentication (MFA/TOTP)
- Magic link authentication
- Password reset flows

### OAuth Security

**File:** `docs/security/OAUTH_SECURITY.md`

#### PKCE (Proof Key for Code Exchange)

**Status:** ✅ Enabled by default (Supabase SDK v2.89.0+)

PKCE prevents authorization code interception attacks:

```typescript
// Handled automatically by Supabase SDK
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',  // Request refresh token
      prompt: 'consent',        // Force consent screen
    },
  },
});
```

**Flow:**
1. Client generates `code_verifier` (random string)
2. Client creates `code_challenge` (SHA-256 hash of verifier)
3. Client sends `code_challenge` to authorization server
4. Authorization server returns authorization code
5. Client exchanges code + `code_verifier` for tokens
6. Server verifies hash matches

#### State Parameter

**Status:** ✅ Enabled by default

Prevents CSRF attacks during OAuth flow:

```
1. SDK generates random state value
2. Stores state in localStorage/cookie
3. Sends state to OAuth provider
4. Provider returns state in callback
5. SDK verifies state matches stored value
```

#### Redirect URL Allowlist

**Configuration:** Supabase Dashboard → Authentication → URL Configuration

**Allowed URLs:**
- Development: `http://localhost:5173/auth/callback`
- Production: `https://[domain]/auth/callback`

**Security:** Only exact matches allowed - prevents open redirect vulnerabilities

---

### Multi-Factor Authentication (MFA)

**File:** `src/services/MFAService.ts`

**Implementation:** TOTP (Time-based One-Time Password)  
**Standard:** RFC 6238  
**Apps:** Google Authenticator, Authy, 1Password, etc.

```typescript
class MFAService {
  // Enable MFA for user
  async enableMFA(userId: string): Promise<MFASetupResponse> {
    // Generate secret
    const secret = await this.generateTOTPSecret();
    
    // Store encrypted secret
    await this.storeEncryptedSecret(userId, secret);
    
    // Return QR code for app enrollment
    return {
      secret,
      qrCode: await this.generateQRCode(secret),
      backupCodes: await this.generateBackupCodes(),
    };
  }
  
  // Verify MFA code
  async verifyMFA(userId: string, code: string): Promise<boolean> {
    const secret = await this.getDecryptedSecret(userId);
    return this.verifyTOTPCode(secret, code);
  }
}
```

**Features:**
- QR code generation for easy setup
- Backup codes for recovery
- Rate limiting on verification attempts
- Encrypted secret storage

---

### Secure Token Management

**File:** `src/lib/auth/SecureTokenManager.ts`

Centralized token management with security best practices:

```typescript
class SecureTokenManager {
  // Store tokens securely
  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    // Encrypt tokens before storage
    const encrypted = await this.encrypt({
      access: accessToken,
      refresh: refreshToken,
      timestamp: Date.now(),
    });
    
    // Store in secure storage (httpOnly cookie in production)
    await this.secureStorage.set('auth_tokens', encrypted);
  }
  
  // Automatic token refresh
  async getValidAccessToken(): Promise<string> {
    const tokens = await this.getDecryptedTokens();
    
    // Check if token is expired or expiring soon
    if (this.isTokenExpiring(tokens.access)) {
      // Refresh token
      const newTokens = await this.refreshTokens(tokens.refresh);
      await this.storeTokens(newTokens.access, newTokens.refresh);
      return newTokens.access;
    }
    
    return tokens.access;
  }
}
```

**Security Features:**
- Token encryption at rest
- Automatic token rotation
- Secure storage (httpOnly cookies in production)
- Token expiry checking
- Refresh token management

**Testing:** `src/lib/auth/__tests__/SecureTokenManager.test.ts` (165 test cases)

---

## Authorization

### Row Level Security (RLS)

**Database:** PostgreSQL (Supabase)  
**Pattern:** Tenant isolation at database level

#### RLS Policies

Every multi-tenant table has RLS enabled:

```sql
-- Enable RLS
ALTER TABLE value_cases ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation
CREATE POLICY "value_cases_tenant_isolation" ON value_cases
FOR ALL USING (
  tenant_id = (
    SELECT NULLIF(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'), 
      ''
    )::text
  )
);
```

**How it works:**
1. User logs in via Supabase Auth
2. JWT token contains `tenant_id` in claims
3. PostgreSQL reads `tenant_id` from JWT
4. RLS automatically filters all queries by tenant
5. No cross-tenant access possible

#### Setting Tenant Context

```typescript
// AuthContext.tsx
useEffect(() => {
  if (user && user.tenant_id) {
    // Set tenant context for RLS
    supabase.rpc('set_tenant_context', {
      tenant_id: user.tenant_id
    });
  }
}, [user]);
```

#### RLS Testing

```sql
-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'value_cases';

-- Test as specific user
SET request.jwt.claims = '{"tenant_id": "abc-123"}';
SELECT * FROM value_cases; -- Only returns tenant abc-123's data
```

---

### Guest Access Control

**Files:**
- `src/services/GuestAccessService.ts`
- `src/components/Guest/GuestBadge.tsx`
- `supabase/migrations/20260106000001_guest_access.sql`

**Security Model:** Cryptographically secure tokens with expiration

```typescript
interface GuestAccess {
  id: string;
  value_case_id: string;
  token: string;              // SHA-256 hash of secret
  permission_level: 'view' | 'comment' | 'edit';
  expires_at: Date;
  created_by: string;
  access_count: number;
  last_accessed_at: Date;
}
```

**Token Generation:**
```typescript
// Generate cryptographically secure token
const secret = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(secret).digest('hex');

// Store hash in database
await supabase.from('guest_access').insert({
  value_case_id,
  token: hash,
  permission_level,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
});

// Send secret to guest (via email, etc.)
const guestUrl = `https://app.valueos.com/guest/${secret}`;
```

**Permission Levels:**
- `view` - Read-only access to value case
- `comment` - Can add comments and annotations
- `edit` - Can modify value case data (restricted fields)

**Security Features:**
- Token hashing (SHA-256)
- Automatic expiration
- Access logging
- Single-use option
- IP allowlist (optional)
- Revocation support

---

## Data Protection

### CSRF Protection

**File:** `src/security/CSRFProtection.ts`

Cross-Site Request Forgery protection for state-changing operations:

```typescript
class CSRFProtection {
  // Generate CSRF token
  generateToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    // Store in session
    sessionStorage.setItem('csrf_token', token);
    return token;
  }
  
  // Validate CSRF token
  validateToken(token: string): boolean {
    const storedToken = sessionStorage.getItem('csrf_token');
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken || '')
    );
  }
}
```

**Usage:**
```typescript
// Add to forms
<input type="hidden" name="csrf_token" value={csrfToken} />

// Validate on submission
if (!CSRFProtection.validateToken(formData.csrf_token)) {
  throw new SecurityError('Invalid CSRF token');
}
```

---

### Rate Limiting

**File:** `src/security/RateLimiter.ts`

Prevents abuse and brute force attacks:

```typescript
class RateLimiter {
  // Check rate limit
  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get recent requests
    const requests = await this.getRequests(key, windowStart);
    
    // Check if over limit
    if (requests.length >= limit) {
      return false; // Rate limited
    }
    
    // Record this request
    await this.recordRequest(key, now);
    return true;
  }
}
```

**Rate Limits:**
- Login attempts: 5 per 15 minutes
- Password reset: 3 per hour
- API calls: 100 per minute
- MFA verification: 5 per 5 minutes
- Guest access: 10 per hour

---

### Input Validation

**Pattern:** Validate all inputs at multiple layers

#### Frontend Validation

```typescript
// Zod schema validation
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Validate before submission
const result = loginSchema.safeParse(formData);
if (!result.success) {
  throw new ValidationError(result.error.errors);
}
```

#### Backend Validation

```sql
-- Database constraints
ALTER TABLE users ADD CONSTRAINT chk_email_format
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Check constraints for data ranges
ALTER TABLE financial_models ADD CONSTRAINT chk_discount_rate
CHECK (discount_rate >= 0 AND discount_rate <= 1);
```

---

## Infrastructure Security

### Container Security

**File:** `.devcontainer/Dockerfile.optimized`

**Security Measures:**
- Non-root user (`node`, UID 1000)
- Minimal base image (Alpine Linux)
- No unnecessary packages
- Read-only root filesystem (production)
- Network isolation

```dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node

# Switch to non-root user
USER node

# Set secure permissions
RUN chmod 755 /app
```

---

### Environment Variables

**Security Rules:**

1. **Never commit secrets** - Use `.env.local` (gitignored)
2. **Separate by environment** - Dev, staging, production
3. **Use Kubernetes Secrets** - In production
4. **Rotate regularly** - API keys, tokens, etc.

**Required Secrets:**
```bash
# Supabase (never expose service role key to frontend)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Public key, safe to expose

# Backend only (never in VITE_ prefix)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEVER expose to frontend
TOGETHER_API_KEY=sk-...           # Server-side only
```

---

### API Security

**Patterns:**

#### Authentication Required

```typescript
// Middleware: Require valid session
async function requireAuth(req: Request): Promise<User> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }
  
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    throw new UnauthorizedError('Invalid token');
  }
  
  return data.user;
}
```

#### Authorization Checks

```typescript
// Check user has permission
async function requirePermission(
  user: User,
  resource: string,
  action: string
): Promise<void> {
  const hasPermission = await checkPermission(user.id, resource, action);
  
  if (!hasPermission) {
    throw new ForbiddenError(`No permission to ${action} ${resource}`);
  }
}
```

---

## Audit Logging

### Agent Execution Logs

**Table:** `agent_executions`

Every agent invocation is logged:

```typescript
await supabase.from('agent_executions').insert({
  tenant_id: user.tenant_id,
  user_id: user.id,
  value_case_id: valueCaseId,
  agent_name: 'OpportunityAgent',
  input: { query, context },
  output: result,
  confidence_score: result.confidence,
  execution_time_ms: elapsedMs,
  llm_calls: metrics.llmCalls,
  cost: metrics.cost,
  status: 'success',
  trace_id: span.spanContext().traceId,
});
```

**Retention:** 90 days (configurable)

---

### User Activity Logs

**Table:** `user_activity`

Track security-relevant user actions:

```sql
CREATE TABLE user_activity (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,  -- 'login', 'logout', 'password_change', etc.
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_action ON user_activity(action, created_at DESC);
```

---

## Security Monitoring

### Real-Time Alerts

**Conditions that trigger alerts:**
- Multiple failed login attempts
- Suspicious IP addresses
- Unusual API usage patterns
- Permission escalation attempts
- Data export operations
- Admin actions

### Security Headers

**Production Configuration:**

```typescript
// Express middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  next();
});
```

---

## Incident Response

### Security Incident Playbook

**Detection → Containment → Eradication → Recovery → Lessons Learned**

#### 1. Detection
- Monitor security logs
- Alert on anomalies
- User reports

#### 2. Containment
- Disable compromised accounts
- Revoke tokens
- Block IP addresses
- Isolate affected systems

#### 3. Eradication
- Identify root cause
- Patch vulnerabilities
- Remove malicious code

#### 4. Recovery
- Restore from backups
- Reset credentials
- Verify integrity

#### 5. Lessons Learned
- Document incident
- Update procedures
- Improve monitoring

---

## Compliance

### GDPR Compliance

**Features:**
- Data export (user can download all their data)
- Right to deletion (cascade deletes)
- Consent tracking
- Data minimization
- Encryption at rest and in transit

### SOC 2 Readiness

**Controls:**
- Access controls (RLS, RBAC)
- Audit logging
- Encryption
- Backup and recovery
- Incident response

---

## Security Checklist

### Development

- [ ] No secrets in code or git history
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize outputs)
- [ ] CSRF tokens on state-changing operations
- [ ] Rate limiting on authentication endpoints

### Deployment

- [ ] HTTPS enabled with valid certificates
- [ ] Security headers configured
- [ ] Environment variables secured
- [ ] Database backups enabled
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

### Operations

- [ ] Regular security updates
- [ ] Access audit reviews
- [ ] Token rotation
- [ ] Backup verification
- [ ] Security training for team

---

## Related Documentation

- `docs/security/OAUTH_SECURITY.md` - OAuth implementation details
- `docs/audits/SUPABASE_AUTH_FIXES.md` - Authentication security fixes
- `docs/audits/SUPABASE_AUTH_SUMMARY.md` - Auth implementation summary
- `src/lib/auth/SecureTokenManager.ts` - Token management
- `src/security/CSRFProtection.ts` - CSRF protection
- `src/security/RateLimiter.ts` - Rate limiting

---

**Maintainer:** Security Team  
**Last Security Audit:** 2026-01-08  
**Next Audit:** 2026-02-08
