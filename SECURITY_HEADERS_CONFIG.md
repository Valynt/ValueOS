# OWASP Security Headers Configuration

## Production Security Headers

### Content Security Policy (CSP)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'strict-dynamic';
  style-src 'self' 'strict-dynamic';
  img-src 'self' data: https:;
  connect-src 'self' https://api.supabase.co https://*.supabase.co;
  font-src 'self' https://fonts.gstatic.com;
  object-src 'none';
  media-src 'self';
  frame-src 'none';
  worker-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  report-uri /api/security/csp-report
```

### HTTP Strict Transport Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### X-Frame-Options (Clickjacking Protection)
```
X-Frame-Options: DENY
```

### X-Content-Type-Options (MIME Sniffing Protection)
```
X-Content-Type-Options: nosniff
```

### X-XSS-Protection (Legacy XSS Protection)
```
X-XSS-Protection: 1; mode=block
```

### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```

### Permissions-Policy (Feature Restrictions)
```
Permissions-Policy:
  camera=(),
  microphone=(),
  geolocation=(),
  interest-cohort=(),
  magnetometer=(),
  gyroscope=(),
  accelerometer=(),
  payment=(),
  usb=()
```

### Cross-Origin Policies
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

### DNS Prefetch Control
```
X-DNS-Prefetch-Control: off
```

## CORS Configuration

### Allowed Origins
- Production: Configured via `CORS_ALLOWED_ORIGINS` environment variable
- Development: `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8080`

### CORS Headers
```
Access-Control-Allow-Origin: [configured origins]
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

## Session/Cookie Security

### Secure Cookie Settings
```
Secure: true (production) / false (development)
HttpOnly: true
SameSite: strict (production) / lax (development)
Max-Age: 86400 (24 hours)
Path: /
```

## CSRF Protection

### CSRF Token Configuration
- **Cookie Name**: `csrf_token`
- **Header Name**: `x-csrf-token`
- **Token Length**: 32 bytes (64 hex characters)
- **Validation**: Double-submit cookie pattern

### CSRF Token Generation
```javascript
// Server-side token generation
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');

// Set in cookie (httpOnly, secure)
res.cookie('csrf_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});
```

### CSRF Token Usage
```javascript
// Client-side: Include in requests
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1];

fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

## File Upload Security

### Upload Limits
- **Max File Size**: 10MB per file
- **Max Files**: 5 files per request
- **Rate Limit**: 10 uploads per hour per user

### Allowed File Types
- `image/jpeg`
- `image/png`
- `image/gif`
- `application/pdf`

### Upload Validation
```javascript
function validateFileUpload(file) {
  // Size check
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large');
  }

  // Type check
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }

  // Additional security checks
  // - File signature validation
  // - Malware scanning
  // - Content analysis

  return true;
}
```

## SSRF Protection

### Blocked Hosts
- `localhost`
- `127.0.0.1`
- `0.0.0.0`
- `169.254.169.254` (AWS metadata)
- `10.0.0.0/8` (private networks)
- `172.16.0.0/12` (private networks)
- `192.168.0.0/16` (private networks)

### Allowed Hosts
- `api.supabase.co`
- `*.supabase.co`
- `api.openai.com`
- `api.together.xyz`
- `api.replicate.com`

### Allowed Ports
- `80` (HTTP)
- `443` (HTTPS)
- `3000` (development)
- `8000` (development)
- `5432` (PostgreSQL)

### SSRF Validation
```javascript
function validateSSRFUrl(url) {
  const parsedUrl = new URL(url);

  // Block private networks
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^169\.254\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
  ];

  if (blockedPatterns.some(pattern => pattern.test(parsedUrl.hostname))) {
    throw new Error('SSRF protection: Private network access blocked');
  }

  // Check allowed hosts
  const allowedHosts = ['api.supabase.co', 'api.openai.com'];
  const isAllowed = allowedHosts.some(host =>
    parsedUrl.hostname === host ||
    parsedUrl.hostname.endsWith('.' + host)
  );

  if (!isAllowed) {
    throw new Error('SSRF protection: Host not in allowlist');
  }

  // Check port
  const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
  const allowedPorts = [80, 443, 3000, 8000, 5432];

  if (!allowedPorts.includes(port)) {
    throw new Error(`SSRF protection: Port ${port} not allowed`);
  }

  return true;
}
```

## Input Validation & XSS Protection

### HTML Sanitization
```javascript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
  });
}
```

### String Sanitization
```javascript
function sanitizeString(input) {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .trim();
}
```

### URL Validation
```javascript
function sanitizeUrl(input) {
  try {
    const url = new URL(input);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return url.toString();
  } catch {
    throw new Error('Invalid URL');
  }
}
```

## Rate Limiting Configuration

### API Rate Limits
- **General API**: 100 requests per minute per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **File Uploads**: 10 uploads per hour per user
- **Agent Execution**: 50 calls per minute per user

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
X-RateLimit-Retry-After: 60
```

## Security Monitoring & Logging

### CSP Violation Reporting
```javascript
app.post('/api/security/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body;

  // Log violation
  logger.warn('CSP Violation', {
    'csp-report': report['csp-report'],
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Send to monitoring service (Sentry, etc.)
  // monitoring.captureException(new Error('CSP Violation'), { extra: report });

  res.status(204).send();
});
```

### Security Event Logging
```javascript
const securityEvents = {
  cspViolation: (report) => logger.warn('CSP Violation', report),
  csrfFailure: (details) => logger.warn('CSRF Failure', details),
  ssrfAttempt: (url, outcome) => logger.warn('SSRF Attempt', { url, outcome }),
  fileUploadBlocked: (file, reason) => logger.warn('File Upload Blocked', { file, reason }),
  rateLimitExceeded: (endpoint, ip) => logger.warn('Rate Limit Exceeded', { endpoint, ip }),
};
```

## Environment Variables

### Required Security Environment Variables
```bash
# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# CSRF
CSRF_ENABLED=true

# Session Security
SESSION_SECRET=your-256-bit-secret-here
TCT_SECRET=your-tct-secret-here

# SSL/TLS
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Security Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
LOG_LEVEL=warn
```

## Deployment Checklist

### Pre-Deployment
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ALLOWED_ORIGINS`
- [ ] Set strong `SESSION_SECRET` and `TCT_SECRET`
- [ ] Enable SSL/TLS certificates
- [ ] Configure CSP report URI
- [ ] Set up security monitoring (Sentry, etc.)
- [ ] Review and test all security headers

### Post-Deployment
- [ ] Verify HSTS preload submission
- [ ] Test CSP in report-only mode first
- [ ] Monitor security logs for violations
- [ ] Set up alerts for security events
- [ ] Regular security audits and updates

## Testing Commands

### Run Security Tests
```bash
# Unit tests
pnpm test -- packages/backend/src/config/__tests__/securityConfig.test.ts

# Integration tests
pnpm test -- packages/backend/src/middleware/__tests__/securityMiddleware.test.ts

# E2E security tests
pnpm test:e2e -- --grep "security"
```

### Security Scanning
```bash
# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-app.com \
  -r security-scan-report.html

# Dependency vulnerability scan
pnpm audit

# SAST scanning
# Integrate with SonarQube or similar
```

### Manual Security Testing
```bash
# Test XSS
curl -X POST https://your-app.com/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"input": "<script>alert(1)</script>"}'

# Test CSRF
curl -X POST https://your-app.com/api/endpoint \
  -H "Content-Type: application/json" \
  # Missing X-CSRF-Token header

# Test SSRF
curl "https://your-app.com/api/proxy?url=http://localhost:3000/internal"

# Test file upload
curl -X POST https://your-app.com/api/upload \
  -F "file=@malicious.exe"
```