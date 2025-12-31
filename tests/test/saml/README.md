# SAML Test Suite Documentation

## Overview

Comprehensive automated testing infrastructure for SAML 2.0 authentication implementation. Includes mock Identity Provider (Keycloak), test fixtures, and Playwright-based compliance verification.

## Architecture

```
test/saml/
├── README.md                          # This file
├── certs/                             # Test certificates
│   ├── generate-test-certs.sh        # Certificate generation script
│   ├── saml-sp-cert.pem              # SP public certificate
│   ├── saml-sp-key.pem               # SP private key
│   ├── saml-sp-expired-cert.pem      # Expired cert for testing
│   ├── saml-idp-cert.pem             # IdP public certificate
│   └── saml-idp-key.pem              # IdP private key
├── keycloak/
│   └── realm-export.json             # Keycloak realm configuration
├── fixtures/
│   └── saml-responses.ts             # Test fixtures and mock data
├── playwright/
    ├── saml-compliance.spec.ts        # Compliance test suite
    └── saml-slo.spec.ts               # Single Logout tests

docker-compose.saml-test.yml           # SAML test environment
```

## Test Coverage

### 1. SAML Compliance Suite (`saml-compliance.spec.ts`)

#### SP-Initiated Flow
- ✅ Successful authentication via SP-initiated SAML flow
- ✅ Correlation ID inclusion in SAML requests
- ✅ Expired account rejection

#### IdP-Initiated Flow
- ✅ Successful authentication via IdP-initiated flow

#### Attribute Mapping
- ✅ Correct SAML attribute mapping to user profile
- ✅ Tenant isolation enforcement via `tenant_id` attribute (GR-010)

#### Clock Skew Tolerance
- ✅ Accept assertions within tolerance window (default: 3 minutes)
- ✅ Reject assertions outside tolerance window

#### Certificate Validation
- ✅ Reject SAML responses with expired certificates

#### Replay Attack Prevention
- ✅ Reject replayed SAML assertions
- ✅ Maintain assertion ID cache

### 2. Single Logout (SLO) Suite (`saml-slo.spec.ts`)

#### Front-Channel Logout (HTTP-Redirect)
- ✅ SP-initiated logout via HTTP-Redirect
- ✅ IdP-initiated logout via HTTP-Redirect

#### Front-Channel Logout (HTTP-POST)
- ✅ Handle logout via HTTP-POST binding

#### Back-Channel Logout (SOAP)
- ✅ Handle back-channel logout request via SOAP

#### Session Invalidation
- ✅ Invalidate session on both IdP and SP sides
- ✅ Return 401 on session reuse after logout
- ✅ Clear all session artifacts (cookies, localStorage)

#### Logout Response Validation
- ✅ Validate LogoutResponse from IdP
- ✅ Handle logout failure gracefully

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ with npm
- OpenSSL (for certificate generation)

### 1. Generate Test Certificates

```bash
cd test/saml/certs
chmod +x generate-test-certs.sh
./generate-test-certs.sh
```

This creates:
- `saml-sp-cert.pem` / `saml-sp-key.pem` - Valid SP certificates
- `saml-sp-expired-cert.pem` - Expired certificate for negative testing
- `saml-idp-cert.pem` / `saml-idp-key.pem` - IdP certificates

### 2. Start SAML Test Environment

```bash
# Start Keycloak IdP and test application
docker-compose -f docker-compose.saml-test.yml up -d

# Wait for services to be healthy
docker-compose -f docker-compose.saml-test.yml ps
```

Services:
- **Keycloak IdP**: http://localhost:8080 (admin/admin)
- **ValueCanvas Test Instance**: http://localhost:5174
- **Redis**: localhost:6380

### 3. Verify Keycloak Configuration

```bash
# Access Keycloak admin console
open http://localhost:8080

# Login: admin / admin
# Navigate to: Realms → valuecanvas-test → Clients
# Verify SAML client is configured
```

### 4. Run SAML Tests

```bash
# Run all SAML tests
npm run test:saml

# Run only compliance tests
npm run test:saml:compliance

# Run only SLO tests
npm run test:saml:slo

# Run with UI (headed mode)
npm run test:saml:headed

# Generate HTML report
npm run test:saml:report
```

### 5. Cleanup

```bash
# Stop all services
docker-compose -f docker-compose.saml-test.yml down

# Remove volumes
docker-compose -f docker-compose.saml-test.yml down -v
```

## Test Users

Configured in Keycloak realm:

### Valid User
- **Username**: `test.user@valuecanvas.test`
- **Password**: `Test123!@#`
- **Tenant ID**: `test-tenant-001`
- **Status**: Enabled

### Expired User
- **Username**: `expired.user@valuecanvas.test`
- **Password**: `Expired123!@#`
- **Status**: Disabled (for testing account validation)

## SAML Endpoints

### Identity Provider (Keycloak)
- **Metadata**: http://localhost:8080/realms/valuecanvas-test/protocol/saml/descriptor
- **SSO URL**: http://localhost:8080/realms/valuecanvas-test/protocol/saml
- **SLO URL**: http://localhost:8080/realms/valuecanvas-test/protocol/saml

### Service Provider (ValueCanvas)
- **Metadata**: http://localhost:5174/saml/metadata
- **ACS URL**: http://localhost:5174/api/auth/saml/acs
- **SLO URL**: http://localhost:5174/api/auth/saml/slo
- **Back-channel SLO**: http://localhost:5174/api/auth/saml/slo/backchannel

## Configuration

### Clock Skew Tolerance

Default: 180 seconds (3 minutes)

Configure in SP settings:
```typescript
// src/config/saml.config.ts
export const SAML_CONFIG = {
  clockSkewToleranceSeconds: 180,
  // ...
};
```

### Assertion Replay Prevention

The system maintains a cache of processed assertion IDs in Redis:

```typescript
// Key format: saml:assertion:{assertion_id}
// TTL: 300 seconds (assertion lifespan)
```

### Session Management

Sessions are stored in Redis with automatic expiration:

```typescript
// Key format: session:{session_id}
// TTL: 1800 seconds (30 minutes idle timeout)
```

## CI/CD Integration

### GitHub Actions Workflow

Add to `.github/workflows/saml-tests.yml`:

```yaml
name: SAML Tests

on:
  pull_request:
    paths:
      - 'src/api/auth/**'
      - 'test/saml/**'
      - 'test/playwright/saml-*.spec.ts'
  push:
    branches: [main, develop]

jobs:
  saml-tests:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate SAML certificates
        run: |
          cd test/saml/certs
          ./generate-test-certs.sh
      
      - name: Start Keycloak IdP
        run: |
          docker-compose -f docker-compose.saml-test.yml up -d keycloak
          docker-compose -f docker-compose.saml-test.yml up -d app-saml-test
      
      - name: Wait for services
        run: |
          timeout 120 bash -c 'until curl -f http://localhost:8080/health/ready; do sleep 2; done'
          timeout 60 bash -c 'until curl -f http://localhost:5174; do sleep 2; done'
      
      - name: Run SAML compliance tests
        run: npm run test:saml:compliance
      
      - name: Run SAML SLO tests
        run: npm run test:saml:slo
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: saml-test-results
          path: |
            playwright-report/
            test-results/
      
      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.saml-test.yml down -v
```

## Troubleshooting

### Issue: Keycloak fails to start

**Solution:**
```bash
# Check logs
docker-compose -f docker-compose.saml-test.yml logs keycloak

# Verify port 8080 is available
lsof -i :8080

# Restart with clean volumes
docker-compose -f docker-compose.saml-test.yml down -v
docker-compose -f docker-compose.saml-test.yml up -d
```

### Issue: Certificate errors

**Solution:**
```bash
# Regenerate certificates
cd test/saml/certs
rm *.pem
./generate-test-certs.sh

# Restart services
docker-compose -f docker-compose.saml-test.yml restart
```

### Issue: Tests fail with timeout

**Solution:**
```bash
# Increase timeout in playwright.config.ts
export default defineConfig({
  timeout: 60000, // 60 seconds
  // ...
});

# Check service health
curl http://localhost:8080/health/ready
curl http://localhost:5174
```

### Issue: Session not invalidating

**Solution:**
```bash
# Check Redis connection
redis-cli -p 6380 -a saml_test_redis_pass PING

# Verify session keys
redis-cli -p 6380 -a saml_test_redis_pass KEYS "session:*"

# Clear all sessions
redis-cli -p 6380 -a saml_test_redis_pass FLUSHDB
```

### Issue: SAML response validation fails

**Solution:**
```bash
# Enable debug logging in tests
DEBUG=saml:* npm run test:saml

# Check correlation IDs in logs
grep "saml-test-" test-results/*/stdout.txt

# Verify IdP metadata
curl http://localhost:8080/realms/valuecanvas-test/protocol/saml/descriptor
```

## Debugging Tests

### Enable Verbose Logging

```bash
# Run with debug output
DEBUG=pw:api npm run test:saml

# Run with headed browser
npm run test:saml:headed

# Run with inspector
PWDEBUG=1 npm run test:saml
```

### Capture Network Traffic

```typescript
// Add to test file
test.beforeEach(async ({ page }) => {
  page.on('request', request => {
    console.log('>>', request.method(), request.url());
  });
  
  page.on('response', response => {
    console.log('<<', response.status(), response.url());
  });
});
```

### Inspect SAML Assertions

Use browser DevTools SAML decoder or:

```bash
# Decode SAML response
echo "<base64_encoded_response>" | base64 -d | xmllint --format -
```

## Security Considerations

### ⚠️ Test Environment Only

**CRITICAL**: This infrastructure is for testing only. Never use in production:

- Weak passwords (admin/admin)
- Self-signed certificates
- Disabled SSL requirements
- Exposed ports
- No rate limiting

### Best Practices

1. **Isolation**: Run tests in isolated Docker network
2. **Cleanup**: Always tear down after tests
3. **Secrets**: Never commit real certificates or keys
4. **Logging**: Redact sensitive data in logs (PII, tokens)

## Performance

### Test Execution Time

- **Compliance Suite**: ~3-5 minutes
- **SLO Suite**: ~2-3 minutes
- **Total**: ~5-8 minutes

### Optimization Tips

1. Run tests in parallel where possible
2. Reuse authentication sessions
3. Use `test.describe.configure({ mode: 'parallel' })`
4. Cache Docker images in CI

## Compliance & Governance

### Global Rules Enforced

- **GR-010**: Tenant Isolation - Verified via `tenant_id` attribute
- **GR-020**: PII Protection - Email/name attributes properly handled

### Local Rules Applicable

- **LR-001**: Scope of Authority - SAML authentication respects user permissions

### Audit Logging

All SAML events are logged with correlation IDs:

```typescript
{
  correlationId: "saml-test-1234567890-abc123",
  event: "saml_authentication_success",
  userId: "test.user@valuecanvas.test",
  tenantId: "test-tenant-001",
  timestamp: "2024-01-01T12:00:00Z"
}
```

## Resources

- [SAML 2.0 Specification](http://docs.oasis-open.org/security/saml/v2.0/)
- [Keycloak SAML Documentation](https://www.keycloak.org/docs/latest/server_admin/#_saml)
- [Playwright Testing](https://playwright.dev/)
- [VOS Security Standards](../../docs/security/SECURITY_STANDARDS.md)

## Support

For issues or questions:
1. Check logs with correlation IDs
2. Review troubleshooting section
3. Consult VOS Security Team
4. Create issue with reproduction steps
