# Authentication Test Execution Checklist

**Quick Reference Guide for Test Execution**  
**Last Updated:** 2026-01-08

---

## Pre-Testing Checklist

- [ ] Test environment is up and running
- [ ] Database is in clean state (or seeded with test data)
- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Test user accounts created
- [ ] Email service configured (or mocked)
- [ ] Logging enabled for debugging

---

## Account Setup Tests - Quick Checklist

### ✅ Positive Tests

- [ ] TEST-SIGNUP-001: Valid registration completes successfully
- [ ] TEST-SIGNUP-008: Terms of Service acceptance works
- [ ] TEST-SIGNUP-007: Email verification flow works
- [ ] TEST-SIGNUP-011: Welcome email is delivered

### ❌ Input Validation Tests

- [ ] TEST-SIGNUP-002: Invalid email formats rejected
- [ ] TEST-SIGNUP-003: Weak passwords rejected
- [ ] TEST-SIGNUP-004: Breached passwords detected
- [ ] TEST-SIGNUP-005: Password mismatch caught
- [ ] TEST-SIGNUP-009: Invalid names handled

### 🔒 Security Tests

- [ ] TEST-SIGNUP-006: Duplicate emails prevented
- [ ] TEST-SIGNUP-012: Rate limiting enforced
- [ ] TEST-SIGNUP-010: Database records created correctly

---

## Login Process Tests - Quick Checklist

### ✅ Valid Login

- [ ] TEST-LOGIN-001: Valid credentials authenticate
- [ ] TEST-LOGIN-006: Session created and persists
- [ ] TEST-LOGIN-010: Redirect to correct page

### ❌ Invalid Credentials

- [ ] TEST-LOGIN-002: Invalid email rejected
- [ ] TEST-LOGIN-003: Invalid password rejected
- [ ] TEST-LOGIN-004: Account lockout after 5 failures

### 🔐 Advanced Auth

- [ ] TEST-LOGIN-007: MFA works correctly
- [ ] TEST-LOGIN-008: MFA enrollment flow
- [ ] TEST-LOGIN-009: Remember Me functionality
- [ ] TEST-LOGIN-011: OAuth Google works
- [ ] TEST-LOGIN-012: OAuth Apple/GitHub work

### 🔄 Password Reset

- [ ] TEST-LOGIN-005: Password reset email sent
- [ ] TEST-LOGIN-005: Reset link works
- [ ] TEST-LOGIN-005: Password updated successfully
- [ ] TEST-LOGIN-005: Old password no longer works

---

## Security Tests - Quick Checklist

### 🛡️ Injection & XSS

- [ ] TEST-SECURITY-001: SQL injection prevented
- [ ] TEST-SECURITY-002: XSS attacks blocked
- [ ] TEST-SECURITY-003: CSRF protection active

### 🔑 Password & Session Security

- [ ] TEST-SECURITY-004: Passwords properly hashed
- [ ] TEST-SECURITY-005: Rate limiting works
- [ ] TEST-SECURITY-006: Sessions secure (HttpOnly, Secure, SameSite)

---

## Performance Tests - Quick Checklist

### ⚡ Load Testing

- [ ] TEST-PERFORMANCE-001: Normal load (100 users) < 1s
- [ ] TEST-PERFORMANCE-001: Peak load (500 users) < 2s
- [ ] TEST-PERFORMANCE-001: Stress test identifies limits
- [ ] TEST-PERFORMANCE-002: Database queries optimized

### 🌐 Browser & Device

- [ ] TEST-COMPATIBILITY-001: Chrome works
- [ ] TEST-COMPATIBILITY-001: Firefox works
- [ ] TEST-COMPATIBILITY-001: Safari works
- [ ] TEST-COMPATIBILITY-001: Edge works
- [ ] TEST-COMPATIBILITY-002: Mobile responsive
- [ ] TEST-COMPATIBILITY-002: Tablet responsive

---

## Edge Cases - Quick Checklist

### 🔧 Error Handling

- [ ] TEST-EDGE-001: Network timeout handled
- [ ] TEST-EDGE-002: Server errors handled (500, 502, 503)
- [ ] TEST-EDGE-003: Concurrent registrations handled
- [ ] TEST-EDGE-008: Database connectivity issues handled
- [ ] TEST-EDGE-009: Third-party service outages handled

### 💡 Special Cases

- [ ] TEST-EDGE-004: Special characters work (O'Connor, José, etc.)
- [ ] TEST-EDGE-005: Max length enforced
- [ ] TEST-EDGE-006: Incomplete forms blocked
- [ ] TEST-EDGE-007: Session expiry handled gracefully
- [ ] TEST-EDGE-010: Time zone issues handled

---

## Automated Test Execution Commands

### Unit Tests

```bash
# All auth unit tests
npm test -- src/services/__tests__/Auth --run

# Specific test suites
npm test -- src/services/__tests__/AuthService.signup.test.ts --run
npm test -- src/services/__tests__/AuthService.login.test.ts --run
npm test -- src/services/__tests__/auth.security.test.ts --run
npm test -- src/services/__tests__/auth.integration.test.ts --run

# With coverage
npm test -- src/services/__tests__/Auth --coverage --run
```

### Component Tests

```bash
# All auth component tests
npm test -- src/views/Auth/__tests__ --run

# Login page tests
npm test -- src/views/Auth/__tests__/LoginPage.test.tsx --run
```

### E2E Tests

```bash
# All E2E auth tests
npx playwright test tests/e2e/auth-flow.spec.ts

# Headed mode (see browser)
npx playwright test tests/e2e/auth-flow.spec.ts --headed

# Debug mode
npx playwright test tests/e2e/auth-flow.spec.ts --debug
```

### Security Tests

```bash
# OWASP ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5173 \
  -r security-report.html

# Custom security tests
npm test -- tests/security/ --run
```

### Load Tests

```bash
# Light load test
k6 run --vus 100 --duration 5m tests/load/auth-load-test.js

# Heavy load test
k6 run --vus 500 --duration 10m tests/load/auth-load-test.js

# Stress test
k6 run tests/load/auth-stress-test.js
```

---

## Test Coverage Verification

### Check Current Coverage

```bash
# Generate coverage report
npm test -- --coverage --run

# View HTML report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Coverage Targets

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| AuthService.ts | 90% | ___% | [ ] |
| LoginPage.tsx | 80% | ___% | [ ] |
| SignupPage.tsx | 80% | ___% | [ ] |
| Security utilities | 90% | ___% | [ ] |

---

## Critical Path Testing (Smoke Test)

**Execute these tests before every deployment:**

1. **Happy Path Signup**
   ```bash
   npx playwright test tests/e2e/smoke/signup-happy-path.spec.ts
   ```
   - [ ] Passed

2. **Happy Path Login**
   ```bash
   npx playwright test tests/e2e/smoke/login-happy-path.spec.ts
   ```
   - [ ] Passed

3. **Password Reset**
   ```bash
   npx playwright test tests/e2e/smoke/password-reset.spec.ts
   ```
   - [ ] Passed

4. **OAuth Sign-In**
   ```bash
   npx playwright test tests/e2e/smoke/oauth-signin.spec.ts
   ```
   - [ ] Passed

---

## Manual Testing Checklist

**For features that require manual verification:**

### Visual/UX Testing

- [ ] Signup form looks correct on desktop
- [ ] Signup form looks correct on mobile
- [ ] Login form looks correct on desktop
- [ ] Login form looks correct on mobile
- [ ] Error messages are user-friendly
- [ ] Loading states are visible
- [ ] Success messages are clear

### Accessibility Testing

- [ ] Tab navigation works
- [ ] Screen reader announces form fields correctly
- [ ] Error messages are announced
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Form works at 200% zoom

### Email Testing

- [ ] Verification email received
- [ ] Email has correct branding
- [ ] Links in email work
- [ ] Email renders correctly on mobile
- [ ] Unsubscribe link works

---

## Test Environment Health Check

### Before Testing

```bash
# Check if dev server is running
curl http://localhost:5173/health || echo "Server not running"

# Check if Supabase is accessible
curl https://your-project.supabase.co/rest/v1/ || echo "Supabase unreachable"

# Check database connection
npm run db:health-check
```

### After Testing

```bash
# Clean up test data
npm run test:cleanup

# Reset rate limiters
npm run test:reset-rate-limits

# Review test logs
cat logs/test-execution.log
```

---

## Bug Reporting Template

**If a test fails, report using this template:**

```markdown
### 🐛 Bug Report

**Test ID:** TEST-SIGNUP-003  
**Test Name:** Password Strength Requirements  
**Environment:** Staging  
**Date:** 2026-01-08

**Expected Behavior:**
Password without uppercase letter should be rejected.

**Actual Behavior:**
Password "password123!" was accepted.

**Steps to Reproduce:**
1. Navigate to /signup
2. Enter email: test@example.com
3. Enter password: password123! (no uppercase)
4. Submit form
5. Account created (should have been rejected)

**Screenshots:**
[Attach screenshot]

**Logs:**
```
[Paste relevant logs]
```

**Impact:** High (Security vulnerability)
**Priority:** P0
**Assigned to:** Backend Team
```

---

## Success Criteria Sign-Off

**Production Deployment Approval:**

| Criteria | Status | Sign-Off |
|----------|--------|----------|
| All P0 tests passing | [ ] | ___________ |
| All P1 tests passing | [ ] | ___________ |
| 90%+ code coverage | [ ] | ___________ |
| 0 critical security issues | [ ] | ___________ |
| Load test SLA met | [ ] | ___________ |
| E2E tests passing | [ ] | ___________ |
| Security scan clean | [ ] | ___________ |
| Manual UAT complete | [ ] | ___________ |

**Approvals:**

- QA Lead: _____________________ Date: __________
- Security Officer: _____________ Date: __________
- Engineering Manager: __________ Date: __________
- Product Manager: ______________ Date: __________

---

## Quick Troubleshooting

### Common Issues

**Issue:** Tests timing out  
**Fix:** Increase timeout in `vitest.config.ts` or check if services are running

**Issue:** Database connection errors  
**Fix:** Verify Supabase credentials in `.env.local`

**Issue:** Rate limit errors in tests  
**Fix:** Run `npm run test:reset-rate-limits` between test runs

**Issue:** OAuth tests failing  
**Fix:** Check if redirect URLs are whitelisted in provider dashboard

**Issue:** Email tests failing  
**Fix:** Verify email service is configured (or use mock mode)

---

**Last Updated:** 2026-01-08  
**Maintained by:** QA Team  
**Questions?** Contact: qa-team@valueos.com
