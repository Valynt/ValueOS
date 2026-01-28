# OWASP Security Hardening Implementation

This document outlines the comprehensive OWASP security hardening measures implemented in the ValueOS application.

## Security Headers Configuration

### Content Security Policy (CSP)

- **Production**: Strict nonce-based CSP
- **Development**: Relaxed for HMR with `'unsafe-eval'` and `'unsafe-inline'`
- **Report URI**: `/api/csp-report`
- **Directives**:
  - `default-src 'self'`
  - `script-src 'self'` (with nonces in production)
  - `style-src 'self'` (with nonces in production)
  - `img-src 'self' data: https:`
  - `connect-src 'self' [allowed domains]`
  - `object-src 'none'`
  - `frame-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`

### Additional Security Headers

- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains; preload`
- **X-Frame-Options**: `DENY`
- **X-Content-Type-Options**: `nosniff`
- **X-XSS-Protection**: `1; mode=block`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Comprehensive feature restrictions
- **Cross-Origin-Embedder-Policy**: `require-corp`
- **Cross-Origin-Opener-Policy**: `same-origin`
- **Cross-Origin-Resource-Policy**: `same-origin`
- **X-Download-Options**: `noopen`
- **X-Permitted-Cross-Domain-Policies**: `none`

## CSRF Protection

### Implementation

- Double-submit cookie pattern
- CSRF token validation on state-changing requests
- Secure cookie attributes:
  - `HttpOnly`
  - `Secure` (in production)
  - `SameSite=Strict` (production) / `SameSite=Lax` (development)
  - `Max-Age=86400` (24 hours)

### Protected Routes

- POST `/api/documents/upload`
- POST `/api/agents/*`
- POST `/api/llm/*`
- All state-changing API endpoints

## XSS Protections

### Frontend (React/Vite)

- DOMPurify for HTML sanitization
- Input sanitization for all user inputs
- CSP with nonces for inline scripts/styles
- Automatic HTML entity encoding

### Backend

- Input validation and sanitization
- CSP headers enforcement
- XSS protection headers

## SSRF Protections

### Network Segmentation

- Private IP range blocking:
  - `127.0.0.0/8` (localhost)
  - `192.168.0.0/16` (private networks)
  - `10.0.0.0/8` (private networks)
  - `172.16.0.0/12` (private networks)
  - IPv6 private ranges (`fc00::/7`, `fe80::/10`)
- Hostname validation
- DNS rebinding protection
- Port restrictions (80, 443, 3000, 8000, 5432 allowed)

### Request Validation

- URL parsing and validation
- Hostname allowlist enforcement
- Request logging and monitoring

## CORS Policy

### Configuration

- **Origins**: Configurable via `CORS_ALLOWED_ORIGINS` env var
- **Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Headers**: `Content-Type, Authorization, X-CSRF-Token`
- **Credentials**: `true`
- **Max Age**: 86400 seconds (24 hours)

### Default Origins (development)

- `http://localhost:8080`
- `http://localhost:5173`
- `http://localhost:3000`

## File Upload Security

### Validation Rules

- **Max File Size**: 10MB per file
- **Max Files**: 5 files per request
- **Allowed MIME Types**:
  - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - Documents: `application/pdf`, `text/plain`, `text/csv`
  - Data: `application/json`, `application/xml`, `text/xml`

### Security Checks

- File extension validation
- MIME type verification
- Path traversal prevention
- Null byte injection detection
- Content-Type header validation (`multipart/form-data` only)

### Rate Limiting

- File uploads: 10 per hour per user
- General API rate limiting: 100 requests per 15 minutes

## Session/Cookie Security

### Cookie Attributes

- **HttpOnly**: Prevents JavaScript access
- **Secure**: HTTPS-only in production
- **SameSite**: `Strict` (production) / `Lax` (development)
- **Max-Age**: 24 hours

### Session Management

- JWT-based authentication with Supabase
- Automatic token refresh
- Secure token storage
- Session timeout enforcement

## Testing

### Test Coverage

- CSRF token validation
- File upload security
- Security headers presence
- SSRF protection
- Input sanitization
- CORS configuration

### Running Tests

```bash
# Backend security tests
cd packages/backend
npm test -- --run owasp-security.test.ts

# Frontend security tests
cd apps/ValyntApp
npm test -- --run security
```

## Configuration

### Environment Variables

```bash
# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com

# CSRF
CSRF_ENABLED=true

# Security headers
NODE_ENV=production  # Enables strict security settings
```

### File Upload Configuration

Modify `packages/backend/src/middleware/fileUploadSecurity.ts`:

```typescript
const DEFAULT_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [...],
  allowedExtensions: [...],
  maxFilesPerRequest: 5,
};
```

## Monitoring & Logging

### Security Events

- CSP violations logged to `/api/csp-report`
- SSRF attempts logged with `ssrf_check` action
- File upload rejections logged with validation errors
- CSRF failures logged with `CSRF validation failed`

### Alerts

- Configure webhook URL via `ALERT_WEBHOOK_URL`
- Email alerts via `ALERT_EMAIL_RECIPIENT`

## Compliance

This implementation addresses the following OWASP Top 10:

- **A01:2021-Broken Access Control**: CSRF protection, CORS policy
- **A02:2021-Cryptographic Failures**: Secure headers, HTTPS enforcement
- **A03:2021-Injection**: Input sanitization, SSRF protection
- **A04:2021-Insecure Design**: Security headers, file upload validation
- **A05:2021-Security Misconfiguration**: Comprehensive security configuration
- **A06:2021-Vulnerable Components**: CSP, dependency scanning
- **A07:2021-Identification/Authentication**: Session security, JWT validation
- **A08:2021-Software/Data Integrity**: File validation, SSRF protection
- **A09:2021-Security Logging**: Comprehensive logging
- **A10:2021-SSRF**: Network segmentation, SSRF protection

## Maintenance

### Regular Updates

- Review and update CSP rules quarterly
- Monitor CSP violation reports
- Update allowed file types as needed
- Review rate limiting thresholds

### Security Audits

- Run automated security scans
- Manual code review for security issues
- Penetration testing validation
- Dependency vulnerability checks
