# Phase 1: Infrastructure & Security Configuration Checklist

**Manual steps required to complete Phase 1 security hardening**

---

## ✅ Checklist Overview

- [ ] Gateway/Load Balancer Configuration
- [ ] Supabase Auth Configuration
- [ ] Auth Router Integration
- [ ] Verification Testing

---

## 🔒 Part 1: Gateway/Load Balancer Configuration

### 1.1 Security Headers (Apply at Gateway/LB Level)

Configure your gateway (Nginx, Apache, Cloudflare, AWS ALB, etc.) to add these headers globally:

#### Content Security Policy (CSP)
```nginx
# Nginx example
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.together.xyz; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" always;
```

```apache
# Apache example
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.together.xyz; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
```

```yaml
# Cloudflare Workers example
headers:
  Content-Security-Policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.together.xyz; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
```

#### HSTS (HTTP Strict Transport Security)
```nginx
# Nginx - HSTS with preload and subdomains
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

```apache
# Apache
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

**IMPORTANT:** Only add `preload` after submitting to https://hstspreload.org/

#### X-Frame-Options
```nginx
# Nginx
add_header X-Frame-Options "DENY" always;
```

```apache
# Apache
Header always set X-Frame-Options "DENY"
```

#### X-Content-Type-Options
```nginx
# Nginx
add_header X-Content-Type-Options "nosniff" always;
```

```apache
# Apache
Header always set X-Content-Type-Options "nosniff"
```

#### Referrer-Policy
```nginx
# Nginx
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

```apache
# Apache
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

### 1.2 Auth Route Rate Limiting (Gateway Level)

Apply stricter rate limits to auth endpoints:

```nginx
# Nginx with ngx_http_limit_req_module
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=general_zone:10m rate=60r/m;
    
    server {
        # Auth endpoints - strict limits
        location ~ ^/auth/(login|register|reset-password) {
            limit_req zone=auth_zone burst=3 nodelay;
            proxy_pass http://backend;
        }
        
        # General endpoints - normal limits
        location / {
            limit_req zone=general_zone burst=10 nodelay;
            proxy_pass http://backend;
        }
    }
}
```

```yaml
# AWS ALB Target Group with rate limiting
Resources:
  AuthRateLimitRule:
    Type: AWS::ElasticLoadBalancingV2::ListenerRule
    Properties:
      Actions:
        - Type: fixed-response
          FixedResponseConfig:
            StatusCode: 429
            ContentType: application/json
            MessageBody: '{"error":"Too many requests"}'
      Conditions:
        - Field: path-pattern
          Values: ['/auth/*']
      # Configure rate limiting via WAF or API Gateway
```

```javascript
// Cloudflare Workers example
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Auth routes - 5 requests per minute
  if (url.pathname.startsWith('/auth/')) {
    const rateLimitKey = `auth:${request.headers.get('CF-Connecting-IP')}`;
    const { success } = await rateLimiter.limit({ key: rateLimitKey });
    
    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }
  }
  
  return fetch(request);
}
```

---

## 🔐 Part 2: Supabase Auth Configuration

### 2.1 Session Configuration

Configure in Supabase Dashboard → Authentication → Settings:

```sql
-- Or via SQL/RPC if you have direct DB access
-- Set session timeouts
ALTER DATABASE postgres SET statement_timeout = '30min';

-- Session configuration via Supabase config.toml (local dev)
-- File: supabase/config.toml
[auth]
site_url = "https://your-domain.com"
additional_redirect_urls = []
jwt_expiry = 3600  # 1 hour absolute
session_idle_timeout = 1800  # 30 minutes idle
enable_signup = true
```

**Supabase Dashboard Steps:**
1. Go to: Authentication → Settings → Auth Policies
2. Set **JWT Expiry**: `3600` seconds (1 hour)
3. Set **Session Timeout**: `1800` seconds (30 min)
4. Enable **Refresh Token Rotation**

### 2.2 Cookie Configuration

Add to your Supabase client configuration:

```typescript
// File: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Use PKCE flow for security
      storage: {
        // Custom storage with secure cookies
        getItem: (key) => {
          // Cookies are HttpOnly, accessed via server
          return null;
        },
        setItem: (key, value) => {
          // Set via server with Secure, HttpOnly, SameSite=Strict
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          });
        },
        removeItem: (key) => {
          fetch('/api/auth/session', { method: 'DELETE' });
        },
      },
    },
  }
);
```

**Server-side cookie configuration:**

```typescript
// File: src/api/auth.ts (Express example)
import { Router, Response } from 'express';

const router = Router();

router.post('/api/auth/session', (req, res) => {
  const { key, value } = req.body;
  
  res.cookie('sb-session', value, {
    httpOnly: true,      // Not accessible via JavaScript
    secure: true,        // HTTPS only
    sameSite: 'strict',  // CSRF protection
    maxAge: 3600000,     // 1 hour
    path: '/',
  });
  
  res.json({ success: true });
});

router.delete('/api/auth/session', (req, res) => {
  res.clearCookie('sb-session');
  res.json({ success: true });
});
```

### 2.3 Password Complexity & MFA (Supabase Dashboard)

**Supabase Dashboard → Authentication → Policies:**

1. **Password Complexity:**
   - Minimum length: 12 characters
   - Require: uppercase, lowercase, number, special character
   
   ```sql
   -- Add password validation via Database Function
   CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
   RETURNS BOOLEAN AS $$
   BEGIN
     RETURN (
       LENGTH(password) >= 12
       AND password ~ '[A-Z]'
       AND password ~ '[a-z]'
       AND password ~ '[0-9]'
       AND password ~ '[!@#$%^&*(),.?":{}|<>]'
     );
   END;
   $$ LANGUAGE plpgsql;
   
   -- Add trigger to auth.users (if you have access)
   -- Or enforce via Edge Function hook
   ```

2. **MFA Configuration:**
   - Go to: Authentication → Settings → Multi-Factor Authentication
   - Enable TOTP (Time-based One-Time Password)
   - Optionally enable SMS MFA

3. **Account Lockout:**

```sql
-- Create lockout tracking table
CREATE TABLE IF NOT EXISTS auth.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  ip_address INET
);

-- Create lockout check function
CREATE OR REPLACE FUNCTION auth.check_account_lockout(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  failed_attempts INT;
BEGIN
  SELECT COUNT(*)
  INTO failed_attempts
  FROM auth.login_attempts
  WHERE email = user_email
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  -- Lock after 5 failed attempts
  RETURN failed_attempts >= 5;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Breach Check (Edge Function)

Create Supabase Edge Function for password breach checking:

```typescript
// File: supabase/functions/check-password-breach/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { password } = await req.json();
  
  // SHA-1 hash the password
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Use HaveIBeenPwned API (k-anonymity)
  const prefix = hashHex.substring(0, 5);
  const suffix = hashHex.substring(5).toUpperCase();
  
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();
  
  const breached = text.split('\n').some(line => {
    const [hash, count] = line.split(':');
    return hash === suffix;
  });
  
  return new Response(
    JSON.stringify({ breached }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

Deploy:
```bash
supabase functions deploy check-password-breach
```

### 2.5 Row Level Security (RLS) Policies

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_add_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own cases"
  ON cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cases"
  ON cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cases"
  ON cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cases"
  ON cases FOR DELETE
  USING (auth.uid() = user_id);

-- Repeat for other tables (workflows, messages, etc.)
```

Apply policies:
```bash
supabase db push
```

---

## 🔌 Part 3: Wire Auth Router into Server

### 3.1 Create Auth Router (if not exists)

```typescript
// File: src/api/auth.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { csrfProtectionMiddleware } from '../middleware/securityMiddleware';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

// Login endpoint with rate limiting
router.post(
  '/login',
  rateLimiters.authentication,
  csrfProtectionMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Check account lockout
      const { data: isLocked } = await supabase.rpc('check_account_lockout', {
        user_email: email,
      });
      
      if (isLocked) {
        return res.status(429).json({
          error: 'Account temporarily locked due to too many failed attempts',
        });
      }
      
      // Check password breach
      const { data: breachCheck } = await supabase.functions.invoke(
        'check-password-breach',
        { body: { password } }
      );
      
      if (breachCheck?.breached) {
        return res.status(400).json({
          error: 'This password has been exposed in a data breach. Please use a different password.',
        });
      }
      
      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Log failed attempt
        await supabase.from('login_attempts').insert({
          email,
          success: false,
          ip_address: req.ip,
        });
        
        return res.status(401).json({ error: error.message });
      }
      
      // Log successful attempt
      await supabase.from('login_attempts').insert({
        email,
        success: true,
        ip_address: req.ip,
      });
      
      // Set secure session cookie
      res.cookie('sb-session', data.session?.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour
      });
      
      res.json({ user: data.user, session: data.session });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Register endpoint
router.post(
  '/register',
  rateLimiters.authentication,
  csrfProtectionMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Validate password strength
      const { data: isStrong } = await supabase.rpc('validate_password_strength', {
        password,
      });
      
      if (!isStrong) {
        return res.status(400).json({
          error: 'Password must be at least 12 characters with uppercase, lowercase, number, and special character',
        });
      }
      
      // Check breach
      const { data: breachCheck } = await supabase.functions.invoke(
        'check-password-breach',
        { body: { password } }
      );
      
      if (breachCheck?.breached) {
        return res.status(400).json({
          error: 'This password has been exposed in a data breach',
        });
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      
      res.json({ user: data.user });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  res.clearCookie('sb-session');
  await supabase.auth.signOut();
  res.json({ success: true });
});

export default router;
```

### 3.2 Wire into Main Server

```typescript
// File: src/server.ts or src/index.ts (your main server file)
import express from 'express';
import authRouter from './api/auth';

const app = express();

// ... other middleware ...

// Mount auth router
app.use('/auth', authRouter);

// ... other routes ...

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## ✅ Part 4: Verification Testing

### 4.1 Run Tests

```bash
# Run all tests
npm test

# Run specific middleware tests
npm test -- src/middleware/__tests__/

# Run with coverage
npm test -- --coverage
```

### 4.2 Manual Verification Checklist

#### Test Security Headers
```bash
# Test production endpoint
curl -I https://your-domain.com

# Verify headers present:
# ✓ Content-Security-Policy
# ✓ Strict-Transport-Security
# ✓ X-Frame-Options: DENY
# ✓ X-Content-Type-Options: nosniff
# ✓ Referrer-Policy: strict-origin-when-cross-origin
```

#### Test CSRF Protection
```bash
# Attempt request without CSRF token (should fail)
curl -X POST https://your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# Expected: 403 Forbidden or CSRF error
```

#### Test Session Enforcement
```bash
# Make authenticated request without session (should fail)
curl https://your-domain.com/api/cases

# Expected: 401 Unauthorized
```

#### Test Weak Password Rejection
```bash
# Try to register with weak password
curl -X POST https://your-domain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"weak"}'

# Expected: 400 Bad Request with password policy error
```

#### Test Breached Password Rejection
```bash
# Try common breached password
curl -X POST https://your-domain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password123!"}'

# Expected: 400 Bad Request if password is breached
```

#### Test MFA Enforcement
```bash
# Try to login with MFA-enabled account without TOTP
curl -X POST https://your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mfa-user@test.com","password":"ValidPassword123!"}'

# Expected: 401 with MFA challenge required
```

#### Test Rate Limiting
```bash
# Rapid-fire auth requests (should get rate limited)
for i in {1..10}; do
  curl -X POST https://your-domain.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' &
done

# Expected: 429 Too Many Requests after threshold
```

---

## 📋 Deployment Checklist

Before going to production:

- [ ] All security headers configured at gateway/LB
- [ ] HSTS submitted to preload list (if applicable)
- [ ] Supabase session timeouts configured
- [ ] Cookie security (HttpOnly, Secure, SameSite) verified
- [ ] Password complexity enforced
- [ ] Breach check Edge Function deployed
- [ ] MFA enabled and tested
- [ ] Account lockout logic deployed
- [ ] RLS policies applied to all tables
- [ ] Auth router wired into server
- [ ] All tests passing (`npm test`)
- [ ] Manual verification completed
- [ ] Rate limiting tested under load
- [ ] CSRF protection verified
- [ ] Session timeout tested
- [ ] Monitoring/alerts configured for auth failures

---

## 🔗 References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Mozilla Security Headers](https://infosec.mozilla.org/guidelines/web_security)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- Project docs: `docs/auth_backend_enforcement.md`

---

**Status:** Manual infrastructure configuration required  
**Owner:** DevOps / Infrastructure Team  
**Timeline:** Complete before production deployment
