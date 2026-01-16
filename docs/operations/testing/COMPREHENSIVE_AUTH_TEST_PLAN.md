# Comprehensive Test Plan: Account Setup and Login Process

**Version:** 1.0  
**Last Updated:** 2026-01-08  
**Status:** Production Ready  
**Objective:** Achieve 100% confidence that users experience zero issues during account setup and login

---

## Table of Contents

1. [Test Strategy Overview](#test-strategy-overview)
2. [Account Setup Testing](#account-setup-testing)
3. [Login Process Testing](#login-process-testing)
4. [Cross-Cutting Concerns](#cross-cutting-concerns)
5. [Security Testing](#security-testing)
6. [Performance Testing](#performance-testing)
7. [Edge Cases and Error Scenarios](#edge-cases-and-error-scenarios)
8. [Test Automation](#test-automation)
9. [Acceptance Criteria](#acceptance-criteria)
10. [Test Execution Plan](#test-execution-plan)

---

## Test Strategy Overview

### Testing Levels

| Level                 | Purpose                                  | Tools               | Coverage Target     |
| --------------------- | ---------------------------------------- | ------------------- | ------------------- |
| **Unit Tests**        | Test individual functions and components | Vitest              | 90%+ code coverage  |
| **Integration Tests** | Test service interactions                | Vitest + Supabase   | 100% critical paths |
| **E2E Tests**         | Test complete user flows                 | Playwright/TestCafe | 100% user journeys  |
| **Security Tests**    | Test security vulnerabilities            | Custom + OWASP ZAP  | 100% attack vectors |
| **Performance Tests** | Test under load                          | k6                  | All scenarios       |

### Test Environments

- **Local Development** - Unit and integration tests
- **Staging** - E2E and security tests
- **Production** - Smoke tests and monitoring

---

## Account Setup Testing

### TEST-SIGNUP-001: Valid User Registration

**Priority:** P0 (Critical)  
**Type:** Positive Test

**Prerequisites:**

- Clean database state
- Valid email not already registered

**Test Steps:**

1. Navigate to `/signup`
2. Enter valid email: `newuser@example.com`
3. Enter valid password: `SecurePass123!@#`
4. Confirm password: `SecurePass123!@#`
5. Enter full name: `John Doe`
6. Accept terms of service (checkbox)
7. Click "Create Account" button

**Expected Results:**

- ✅ Form validates successfully
- ✅ Account is created in database
- ✅ User receives verification email
- ✅ User is redirected to verification pending page
- ✅ Session is created
- ✅ Rate limit is reset for the email
- ✅ Audit log entry is created
- ✅ User record has correct tenant_id

**Database Validation:**

```sql
-- Verify user exists
SELECT id, email, full_name, tenant_id, email_confirmed_at
FROM auth.users
WHERE email = 'newuser@example.com';

-- Verify audit log
SELECT * FROM user_activity
WHERE action = 'signup' AND email = 'newuser@example.com';
```

**Acceptance Criteria:**

- Account creation completes in < 2 seconds
- User ID is valid UUID
- Tenant ID is properly assigned
- Email verification token is generated

---

### TEST-SIGNUP-002: Email Format Validation

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Test Cases:**

| Test Case                    | Input                    | Expected Behavior             |
| ---------------------------- | ------------------------ | ----------------------------- |
| Missing @ symbol             | `userexample.com`        | Error: "Invalid email format" |
| Missing domain               | `user@`                  | Error: "Invalid email format" |
| Missing local part           | `@example.com`           | Error: "Invalid email format" |
| Invalid TLD                  | `user@example`           | Error: "Invalid email format" |
| Multiple @ symbols           | `user@@example.com`      | Error: "Invalid email format" |
| Spaces in email              | `user @example.com`      | Error: "Invalid email format" |
| Very long email (>254 chars) | `a`×255 + `@example.com` | Error: "Email too long"       |

**Test Steps (for each case):**

1. Navigate to `/signup`
2. Enter invalid email from table above
3. Enter valid password
4. Attempt to submit form

**Expected Results:**

- ✅ Form validation prevents submission
- ✅ Error message displays immediately
- ✅ Error message is user-friendly
- ✅ No API call is made
- ✅ Other fields remain filled

**Implementation:**

- Frontend validation (Zod schema)
- HTML5 validation (input type="email")
- Backend validation (Supabase)
- Database constraint

---

### TEST-SIGNUP-003: Password Strength Requirements

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Password Requirements:**

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Test Cases:**

| Test Case        | Password         | Expected Error                              |
| ---------------- | ---------------- | ------------------------------------------- |
| Too short        | `Pass1!`         | "Password must be at least 8 characters"    |
| No uppercase     | `password123!`   | "Password must contain an uppercase letter" |
| No lowercase     | `PASSWORD123!`   | "Password must contain a lowercase letter"  |
| No numbers       | `Password!@#`    | "Password must contain a number"            |
| No special chars | `Password123`    | "Password must contain a special character" |
| All requirements | `SecurePass123!` | ✅ Accept                                   |

**Test Steps:**

1. For each test case, enter the password
2. Observe real-time validation feedback
3. Attempt form submission

**Expected Results:**

- ✅ Validation errors shown in real-time
- ✅ Submit button disabled until valid
- ✅ Clear guidance on requirements
- ✅ Password strength indicator updates

**Additional Validations:**

- Password cannot be the same as email
- Password cannot contain user's name
- Common patterns rejected (123456, qwerty, etc.)

---

### TEST-SIGNUP-004: Password Breach Detection

**Priority:** P1 (High)  
**Type:** Security Test

**Test Cases:**

| Password       | Breach Status | Expected Behavior   |
| -------------- | ------------- | ------------------- |
| `Password123!` | Known breach  | Reject with warning |
| `Tr0ub4dor&3`  | Known breach  | Reject with warning |
| `G7$kL9#mP2qX` | Not breached  | ✅ Accept           |

**Test Steps:**

1. Navigate to `/signup`
2. Enter email and breached password
3. Submit form

**Expected Results:**

- ✅ API checks password against Have I Been Pwned
- ✅ Breached password is rejected
- ✅ User shown: "This password has been exposed in a data breach. Please choose a different password."
- ✅ No account is created
- ✅ Suggestion to use password manager

**Implementation:**

```typescript
// src/security/index.ts
export async function checkPasswordBreach(password: string): Promise<boolean> {
  const hash = sha1(password);
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
  );
  const data = await response.text();

  return data.includes(suffix.toUpperCase());
}
```

---

### TEST-SIGNUP-005: Password Confirmation Matching

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Test Cases:**

| Password         | Confirm Password | Expected Behavior                     |
| ---------------- | ---------------- | ------------------------------------- |
| `SecurePass123!` | `SecurePass123!` | ✅ Accept                             |
| `SecurePass123!` | `SecurePass124!` | Error: "Passwords do not match"       |
| `SecurePass123!` | `` (empty)       | Error: "Please confirm your password" |

**Test Steps:**

1. Enter password in first field
2. Enter different password in confirm field
3. Observe validation

**Expected Results:**

- ✅ Real-time validation on blur
- ✅ Error message below confirm field
- ✅ Submit disabled until match
- ✅ Visual indicator (red border, etc.)

---

### TEST-SIGNUP-006: Duplicate Email Prevention

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Prerequisites:**

- Existing user: `existing@example.com`

**Test Steps:**

1. Navigate to `/signup`
2. Enter existing email: `existing@example.com`
3. Enter valid password
4. Submit form

**Expected Results:**

- ✅ API returns error: "User already registered"
- ✅ UI shows: "An account with this email already exists"
- ✅ Link to login page provided
- ✅ Link to password reset provided
- ✅ No duplicate account created
- ✅ Rate limit consumed (prevent enumeration)

**Security Note:**

- Timing attacks mitigated (same response time for existing/non-existing)
- Consider "This email is already registered" vs generic error for UX

---

### TEST-SIGNUP-007: Email Verification Workflow

**Priority:** P0 (Critical)  
**Type:** Integration Test

**Test Steps:**

1. Complete signup form
2. Check email inbox for verification email
3. Click verification link
4. Observe account activation

**Expected Results:**

- ✅ Email sent within 60 seconds
- ✅ Email contains:
  - Welcome message
  - Verification link (valid for 24 hours)
  - Link to support
  - Unsubscribe option (GDPR compliance)
- ✅ Clicking link activates account
- ✅ User redirected to login or dashboard
- ✅ `email_confirmed_at` timestamp set
- ✅ Welcome email sent after confirmation

**Email Template Validation:**

- Subject line: "Verify your ValueOS account"
- Sender: `noreply@valueos.com`
- Reply-to: `support@valueos.com`
- Contains company branding
- Mobile responsive

**Edge Cases:**

- Expired verification link (> 24 hours)
- Already verified email
- Invalid token
- Resend verification email

---

### TEST-SIGNUP-008: Terms of Service Acceptance

**Priority:** P1 (High)  
**Type:** Compliance Test

**Test Steps:**

1. Navigate to `/signup`
2. Fill all fields except ToS checkbox
3. Attempt submission

**Expected Results:**

- ✅ Form blocked from submission
- ✅ Error: "You must accept the Terms of Service"
- ✅ Checkbox highlighted
- ✅ Link to ToS opens in new tab
- ✅ Acceptance recorded in database

**Database Validation:**

```sql
SELECT tos_accepted_at, tos_version
FROM users
WHERE email = 'user@example.com';
```

**Compliance Requirements:**

- ToS version tracked
- Timestamp of acceptance recorded
- Copy of accepted ToS archived
- GDPR compliant consent

---

### TEST-SIGNUP-009: Full Name Validation

**Priority:** P2 (Medium)  
**Type:** Validation Test

**Test Cases:**

| Input                           | Expected Behavior                |
| ------------------------------- | -------------------------------- |
| `John Doe`                      | ✅ Accept                        |
| `Jean-Pierre O'Connor`          | ✅ Accept (special chars)        |
| `José María`                    | ✅ Accept (unicode)              |
| `X`                             | Error: "Name too short"          |
| `A`×101                         | Error: "Name too long (max 100)" |
| `` (empty)                      | Error: "Full name required"      |
| `<script>alert('xss')</script>` | Sanitized, stored safely         |

**Expected Results:**

- ✅ Accepts international characters
- ✅ Accepts hyphens, apostrophes, spaces
- ✅ Min length: 2 characters
- ✅ Max length: 100 characters
- ✅ XSS protection (sanitization)

---

### TEST-SIGNUP-010: Account Activation and Database Record Creation

**Priority:** P0 (Critical)  
**Type:** Integration Test

**Test Steps:**

1. Complete full signup flow
2. Verify email
3. Query database

**Expected Database State:**

```sql
-- auth.users table
SELECT
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data->>'full_name' as full_name,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'newuser@example.com';

-- public.users table (if separate)
SELECT
  id,
  tenant_id,
  role,
  created_at
FROM public.users
WHERE email = 'newuser@example.com';

-- tenants table (if multi-tenant)
SELECT
  id,
  name,
  created_at,
  status
FROM tenants
WHERE id = (SELECT tenant_id FROM users WHERE email = 'newuser@example.com');
```

**Expected Results:**

- ✅ User record exists with valid UUID
- ✅ Email confirmed timestamp set
- ✅ Full name stored correctly
- ✅ Tenant created and assigned
- ✅ Default role assigned (e.g., 'user')
- ✅ All timestamps accurate
- ✅ No orphaned records

---

### TEST-SIGNUP-011: Welcome Email Delivery

**Priority:** P2 (Medium)  
**Type:** Integration Test

**Trigger:** After email verification complete

**Expected Email Content:**

- Subject: "Welcome to ValueOS!"
- Personalized greeting: "Hi [Full Name],"
- Quick start guide link
- Link to documentation
- Support contact information
- Social media links

**Test Validation:**

1. Email delivered within 2 minutes
2. All links functional
3. Unsubscribe link works
4. Email rendering correct in:
   - Gmail
   - Outlook
   - Apple Mail
   - Mobile clients

---

### TEST-SIGNUP-012: Rate Limiting on Signup

**Priority:** P1 (High)  
**Type:** Security Test

**Rate Limit:** 3 signup attempts per 15 minutes per IP

**Test Steps:**

1. Attempt 3 signups from same IP
2. Attempt 4th signup immediately

**Expected Results:**

- ✅ First 3 attempts processed normally
- ✅ 4th attempt blocked with error
- ✅ Error: "Too many signup attempts. Please try again in 15 minutes."
- ✅ Retry-After header sent
- ✅ Rate limit resets after 15 minutes

**Implementation:**

```typescript
// src/security/RateLimiter.ts
const signupLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 15 * 60 * 1000, // 15 minutes
});
```

---

## Login Process Testing

### TEST-LOGIN-001: Valid Credential Authentication

**Priority:** P0 (Critical)  
**Type:** Positive Test

**Prerequisites:**

- Existing verified user: `user@example.com` / `SecurePass123!`

**Test Steps:**

1. Navigate to `/login`
2. Enter email: `user@example.com`
3. Enter password: `SecurePass123!`
4. Click "Sign In" button

**Expected Results:**

- ✅ Credentials validated successfully
- ✅ Session created with valid access token
- ✅ User redirected to dashboard (`/`)
- ✅ Rate limit reset
- ✅ User object available in AuthContext
- ✅ Login event logged in audit trail

**Session Validation:**

```typescript
// Verify session
const {
  data: { session },
} = await supabase.auth.getSession();
expect(session).toBeDefined();
expect(session.access_token).toBeDefined();
expect(session.refresh_token).toBeDefined();
expect(session.expires_at).toBeGreaterThan(Date.now());
```

**Performance:**

- Login completes in < 1 second
- Token validation in < 100ms

---

### TEST-LOGIN-002: Invalid Email

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Test Cases:**

| Email                     | Password         | Expected Error              |
| ------------------------- | ---------------- | --------------------------- |
| `nonexistent@example.com` | `SecurePass123!` | "Invalid email or password" |
| `user@wrong-domain.com`   | `SecurePass123!` | "Invalid email or password" |

**Test Steps:**

1. Enter non-existent email
2. Enter any password
3. Submit form

**Expected Results:**

- ✅ Generic error message (prevents user enumeration)
- ✅ Same response time as valid login (timing attack mitigation)
- ✅ Rate limit consumed
- ✅ Failed login logged
- ✅ No session created

**Security Consideration:**

- Don't reveal whether email exists
- Use constant-time comparison
- Log for brute force detection

---

### TEST-LOGIN-003: Invalid Password

**Priority:** P0 (Critical)  
**Type:** Negative Test

**Prerequisites:**

- Existing user: `user@example.com`

**Test Steps:**

1. Enter valid email: `user@example.com`
2. Enter wrong password: `WrongPassword123!`
3. Submit form

**Expected Results:**

- ✅ Error: "Invalid email or password"
- ✅ Failed attempt counter incremented
- ✅ Rate limit consumed
- ✅ After 5 failed attempts: account locked
- ✅ Lockout notification email sent

**Lockout Behavior:**

- Lockout duration: 15 minutes
- Email notification includes:
  - Timestamp of lockout
  - IP address of attempt
  - Link to reset password
  - "Wasn't you?" security alert

---

### TEST-LOGIN-004: Account Lockout Mechanism

**Priority:** P1 (High)  
**Type:** Security Test

**Configuration:**

- Max failed attempts: 5
- Lockout duration: 15 minutes
- Exponential backoff: 2x per additional failure

**Test Steps:**

1. Attempt login with wrong password 5 times
2. Observe lockout
3. Wait 15 minutes
4. Attempt login again

**Expected Results:**

- ✅ After 5 failures: "Account temporarily locked"
- ✅ Lockout timer displayed
- ✅ Login blocked even with correct password
- ✅ After 15 minutes: lockout cleared
- ✅ Email notification sent
- ✅ Admin notification for repeated lockouts

**Database State:**

```sql
SELECT
  email,
  failed_login_attempts,
  locked_until
FROM auth.users
WHERE email = 'user@example.com';
```

---

### TEST-LOGIN-005: Password Reset Functionality

**Priority:** P0 (Critical)  
**Type:** Integration Test

**Complete Flow Test:**

1. **Initiate Reset**
   - Click "Forgot Password?"
   - Enter email
   - Submit

2. **Receive Email**
   - Email delivered < 60 seconds
   - Contains secure reset link
   - Link valid for 1 hour

3. **Reset Password**
   - Click link in email
   - Redirected to reset page
   - Enter new password
   - Confirm new password
   - Submit

4. **Validate Reset**
   - Password updated in database
   - Old password no longer works
   - New password works
   - All sessions invalidated
   - User notified of password change

**Expected Results:**

- ✅ All steps complete successfully
- ✅ Reset token is single-use
- ✅ Expired tokens rejected
- ✅ Invalid tokens rejected
- ✅ User can login with new password

**Security Validations:**

- Token: 32-byte cryptographically secure random
- Token hashed in database (SHA-256)
- Rate limit: 3 reset requests per hour
- Email change notification

---

### TEST-LOGIN-006: Session Management

**Priority:** P0 (Critical)  
**Type:** Integration Test

**Test Cases:**

#### Session Creation

- ✅ Access token generated (JWT)
- ✅ Refresh token generated
- ✅ Expires_at set (1 hour default)
- ✅ Session stored in Supabase

#### Session Persistence

- ✅ Page refresh maintains session
- ✅ Session survives browser restart (if "Remember Me")
- ✅ Session clears on logout

#### Token Refresh

- ✅ Access token automatically refreshed before expiry
- ✅ Refresh token rotates on use
- ✅ Expired refresh token rejects

#### Concurrent Sessions

- ✅ User can have multiple sessions (different devices)
- ✅ Logout one device doesn't affect others
- ✅ "Logout all devices" terminates all sessions

---

### TEST-LOGIN-007: Multi-Factor Authentication (MFA)

**Priority:** P1 (High)  
**Type:** Security Test

**Prerequisites:**

- User has MFA enabled
- TOTP app configured

**Login Flow with MFA:**

1. **Initial Login**
   - Enter email + password
   - Successful credential validation
   - Prompted for MFA code

2. **MFA Code Entry**
   - Enter 6-digit TOTP code
   - Verify code
   - Complete login

**Test Cases:**

| Scenario     | MFA Code              | Expected Behavior               |
| ------------ | --------------------- | ------------------------------- |
| Valid code   | `123456` (valid TOTP) | ✅ Login success                |
| Invalid code | `000000`              | Error: "Invalid code"           |
| Expired code | Previous valid code   | Error: "Invalid code"           |
| Backup code  | `ABCD-EFGH-IJKL`      | ✅ Login success, code consumed |

**Expected Results:**

- ✅ MFA required for privileged roles (admin, super_admin)
- ✅ MFA optional for regular users
- ✅ Code validation rate limited (5 attempts / 5 minutes)
- ✅ Backup codes work once
- ✅ MFA can be disabled (with password confirmation)

**Implementation:**

```typescript
// src/services/MFAService.ts
class MFAService {
  async verifyTOTP(userId: string, code: string): Promise<boolean> {
    const secret = await this.getUserSecret(userId);
    const isValid = authenticator.verify({
      token: code,
      secret: secret,
    });
    return isValid;
  }
}
```

---

### TEST-LOGIN-008: MFA Enrollment Flow

**Priority:** P1 (High)  
**Type:** Integration Test

**Test Steps:**

1. **Navigate to MFA Setup**
   - Go to Settings → Security
   - Click "Enable Two-Factor Authentication"

2. **Generate Secret**
   - QR code displayed
   - Manual entry code shown
   - Download backup codes

3. **Verify Setup**
   - Scan QR with authenticator app
   - Enter first code
   - Verify code

4. **Confirm Enrollment**
   - MFA enabled
   - Backup codes saved
   - Recovery options configured

**Expected Results:**

- ✅ QR code scannable
- ✅ Manual entry code works
- ✅ 8 backup codes generated
- ✅ Secret encrypted in database
- ✅ Email notification sent
- ✅ MFA required on next login

---

### TEST-LOGIN-009: Remember Me Functionality

**Priority:** P2 (Medium)  
**Type:** Integration Test

**Test Steps:**

1. **Login with Remember Me**
   - Check "Remember Me" checkbox
   - Complete login
   - Close browser

2. **Open New Session**
   - Open browser
   - Navigate to app
   - Observe auto-login

3. **Login without Remember Me**
   - Uncheck "Remember Me"
   - Complete login
   - Close browser
   - Observe logout

**Expected Results:**

- ✅ With "Remember Me": session persists 30 days
- ✅ Without "Remember Me": session clears on browser close
- ✅ Token stored in:
  - With: localStorage (persistent)
  - Without: sessionStorage (temporary)

**Security:**

- Refresh token encrypted
- Option to revoke persistent tokens
- List of active sessions viewable

---

### TEST-LOGIN-010: Redirect to Appropriate Landing Page

**Priority:** P2 (Medium)  
**Type:** UX Test

**Redirect Logic:**

| User Role | Login Source        | Redirect Destination   |
| --------- | ------------------- | ---------------------- |
| Admin     | Direct login        | `/admin/dashboard`     |
| User      | Direct login        | `/` (dashboard)        |
| Guest     | From deep link      | Return to original URL |
| User      | After signup verify | `/onboarding`          |

**Test Steps:**

1. Login as each role
2. Verify correct redirect
3. Test deep link preservation

**Expected Results:**

- ✅ Role-based redirects
- ✅ Deep link preservation with `?redirect=/path`
- ✅ Default to dashboard if no redirect
- ✅ Prevent open redirect vulnerabilities

**Security:**

- Validate redirect URLs against allowlist
- Only internal redirects permitted

---

### TEST-LOGIN-011: OAuth Sign-In (Google)

**Priority:** P1 (High)  
**Type:** Integration Test

**Test Steps:**

1. **Initiate OAuth**
   - Click "Continue with Google"
   - Redirect to Google consent screen

2. **Grant Consent**
   - Select Google account
   - Grant permissions
   - Redirect back to app

3. **Complete Sign-In**
   - User authenticated
   - Account created (if new) or logged in (if existing)
   - Profile synced

**Expected Results:**

- ✅ OAuth flow completes successfully
- ✅ PKCE enabled (security)
- ✅ State parameter validated (CSRF protection)
- ✅ Redirect URL validated
- ✅ User profile synced (email, name, avatar)
- ✅ Existing account merged if email matches

**OAuth Providers:**

- Google ✅
- Apple ✅
- GitHub ✅

**Security Validations:**

- PKCE code challenge/verifier
- State parameter CSRF protection
- Redirect URL allowlist
- Token validation

---

### TEST-LOGIN-012: OAuth Sign-In (Apple, GitHub)

**Priority:** P2 (Medium)  
**Type:** Integration Test

**Test Apple Sign-In:**

- Apple ID authentication
- Privacy relay email handling
- Account linking

**Test GitHub Sign-In:**

- GitHub OAuth flow
- Email verification (if GitHub email unverified)
- Organization permissions

---

## Cross-Cutting Concerns

### TEST-SECURITY-001: SQL Injection Prevention

**Priority:** P0 (Critical)  
**Type:** Security Test

**Attack Vectors:**

```typescript
// Test inputs designed to exploit SQL injection
const sqlInjectionAttempts = [
  "admin'--",
  "admin' OR '1'='1",
  "admin'; DROP TABLE users;--",
  "admin' UNION SELECT * FROM users--",
  "admin' AND 1=1--",
  "' OR 1=1 --",
  "1' ORDER BY 1--+",
];
```

**Test Steps:**

1. For each injection attempt:
   - Use as email in signup
   - Use as password in login
   - Use in search fields
2. Observe behavior

**Expected Results:**

- ✅ No SQL injection successful
- ✅ Inputs sanitized or rejected
- ✅ Parameterized queries used everywhere
- ✅ ORM/query builder used (Supabase client)
- ✅ Error messages don't reveal DB structure

**Implementation:**

```typescript
// ✅ Safe - Parameterized query
const { data, error } = await supabase
  .from("users")
  .select("*")
  .eq("email", userInput); // Automatically parameterized

// ❌ Unsafe - String concatenation (DON'T DO THIS)
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
```

---

### TEST-SECURITY-002: Cross-Site Scripting (XSS) Prevention

**Priority:** P0 (Critical)  
**Type:** Security Test

**Attack Vectors:**

```typescript
const xssAttempts = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  "<iframe src=\"javascript:alert('XSS')\">",
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  '<svg onload=alert("XSS")>',
  '<body onload=alert("XSS")>',
];
```

**Test Locations:**

- Full name field
- Email field
- Comments/notes
- Profile bio
- Any user-generated content

**Test Steps:**

1. Input XSS payload in each field
2. Save data
3. View data in various contexts
4. Check if script executes

**Expected Results:**

- ✅ No scripts execute
- ✅ HTML entities encoded
- ✅ Content Security Policy blocks inline scripts
- ✅ Sanitization library used (DOMPurify)
- ✅ React auto-escapes by default

**Implementation:**

```typescript
// ✅ Safe - React auto-escapes
<div>{userInput}</div>

// ✅ Safe - Explicit sanitization
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />

// ❌ Unsafe - Don't use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

---

### TEST-SECURITY-003: Cross-Site Request Forgery (CSRF) Protection

**Priority:** P1 (High)  
**Type:** Security Test

**Test Steps:**

1. **Craft Malicious Request**

   ```html
   <!-- Attacker's page -->
   <form action="https://valueos.com/api/changePassword" method="POST">
     <input type="hidden" name="newPassword" value="hacked123" />
   </form>
   <script>
     document.forms[0].submit();
   </script>
   ```

2. **Attempt CSRF Attack**
   - User logged into ValueOS
   - User visits attacker's page
   - Malicious form auto-submits

**Expected Results:**

- ✅ Request rejected (missing CSRF token)
- ✅ 403 Forbidden error
- ✅ No state change occurs

**CSRF Protection Mechanisms:**

- **Supabase SDK**: Automatically handles CSRF via SameSite cookies
- **Custom Forms**: CSRF tokens required
- **State-changing operations**: Must include valid token

**Implementation:**

```typescript
// Generate CSRF token
const csrfToken = CSRFProtection.generateToken();

// Include in form
<input type="hidden" name="csrf_token" value={csrfToken} />

// Validate on server
if (!CSRFProtection.validateToken(req.body.csrf_token)) {
  throw new SecurityError('Invalid CSRF token');
}
```

---

### TEST-SECURITY-004: Password Storage Security

**Priority:** P0 (Critical)  
**Type:** Security Audit

**Validation Checklist:**

- ✅ Passwords hashed (never stored plaintext)
- ✅ Strong hashing algorithm (bcrypt/Argon2)
- ✅ Salt per password (automatic with bcrypt)
- ✅ Sufficient work factor (bcrypt cost >= 10)
- ✅ Passwords never logged
- ✅ Passwords never in error messages
- ✅ Password reset invalidates old hash

**Test:**

1. Create account with password `TestPass123!`
2. Query database directly
3. Verify password is hashed

**Database Query:**

```sql
-- Should see hash, not plaintext
SELECT encrypted_password FROM auth.users WHERE email = 'test@example.com';
-- Example hash: $2b$10$N9qo8uLOickgx2ZMRZoMye.IWq93oc7XK3LPX4kA1B5a5uxl
```

**Expected:**

- Hash should look like `$2b$10$...` (bcrypt)
- Never see plaintext password
- Hash changes when password changes

---

### TEST-SECURITY-005: Rate Limiting

**Priority:** P1 (High)  
**Type:** Security Test

**Rate Limits:**

| Endpoint         | Limit       | Window | Lockout |
| ---------------- | ----------- | ------ | ------- |
| Login            | 5 attempts  | 15 min | 15 min  |
| Signup           | 3 attempts  | 15 min | 15 min  |
| Password Reset   | 3 attempts  | 1 hour | 1 hour  |
| MFA Verification | 5 attempts  | 5 min  | 5 min   |
| OAuth            | 10 attempts | 15 min | 15 min  |

**Test Steps:**

1. Exceed rate limit for endpoint
2. Observe rejection
3. Wait for window to expire
4. Verify reset

**Expected Results:**

- ✅ Rate limits enforced
- ✅ 429 Too Many Requests status
- ✅ Retry-After header sent
- ✅ Clear error message
- ✅ Automatic reset after window

**Implementation:**

```typescript
// Client-side rate limiting
await clientRateLimit.checkLimit("auth-attempts");

// Server-side rate limiting
await consumeAuthRateLimit(email);
```

---

### TEST-SECURITY-006: Session Security

**Priority:** P0 (Critical)  
**Type:** Security Audit

**Security Checklist:**

- ✅ Session tokens cryptographically secure
- ✅ Tokens transmitted over HTTPS only
- ✅ HttpOnly cookies (not accessible via JS)
- ✅ Secure flag set (HTTPS only)
- ✅ SameSite=Strict (CSRF protection)
- ✅ Session expiration (1 hour default)
- ✅ Absolute timeout (even if active)
- ✅ Session invalidation on logout
- ✅ Session regeneration after privilege change

**Test Cases:**

1. **Token Security**

   ```typescript
   // Verify token properties
   expect(document.cookie).not.toContain("sb-access-token"); // HttpOnly
   ```

2. **Session Fixation**
   - Login should generate new session ID
   - Old session ID should be invalid

3. **Session Hijacking**
   - Stolen token should expire
   - IP change detection (optional)
   - User agent change detection (optional)

---

### TEST-PERFORMANCE-001: Performance Under Load

**Priority:** P1 (High)  
**Type:** Load Test

**Test Scenarios:**

#### Scenario 1: Normal Load

- **Users:** 100 concurrent
- **Duration:** 5 minutes
- **Actions:** Login, browse, logout
- **Target:** < 1s average response time

#### Scenario 2: Peak Load

- **Users:** 500 concurrent
- **Duration:** 10 minutes
- **Actions:** Mixed (70% login, 20% signup, 10% password reset)
- **Target:** < 2s average response time

#### Scenario 3: Stress Test

- **Users:** Ramp 0 → 1000 over 10 min
- **Duration:** 30 minutes
- **Target:** Identify breaking point

**Metrics to Track:**

- Response time (p50, p95, p99)
- Error rate (target < 0.1%)
- Throughput (requests/second)
- Database connection pool usage
- Memory usage
- CPU usage

**Load Test Implementation (k6):**

```javascript
// tests/performance/auth-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests < 2s
    http_req_failed: ["rate<0.01"], // Error rate < 1%
  },
};

export default function () {
  // Login flow
  const loginRes = http.post("https://api.valueos.com/auth/login", {
    email: "loadtest@example.com",
    password: "SecurePass123!",
  });

  check(loginRes, {
    "login successful": (r) => r.status === 200,
    "response time OK": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

---

### TEST-PERFORMANCE-002: Database Query Performance

**Priority:** P1 (High)  
**Type:** Performance Test

**Critical Queries to Optimize:**

1. **User Lookup by Email**

   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM auth.users WHERE email = 'user@example.com';
   ```

   - **Target:** < 10ms
   - **Index:** `idx_users_email`

2. **Session Validation**

   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM auth.sessions WHERE token = 'xxx' AND expires_at > NOW();
   ```

   - **Target:** < 5ms
   - **Index:** `idx_sessions_token`, `idx_sessions_expires_at`

3. **Rate Limit Check**
   ```sql
   EXPLAIN ANALYZE
   SELECT COUNT(*) FROM auth_attempts
   WHERE identifier = 'user@example.com'
   AND created_at > NOW() - INTERVAL '15 minutes';
   ```

   - **Target:** < 20ms
   - **Index:** `idx_auth_attempts_identifier_created`

**Optimization Checklist:**

- ✅ All foreign keys indexed
- ✅ Lookup columns indexed
- ✅ Composite indexes for multi-column queries
- ✅ Partial indexes where applicable
- ✅ Query plan analyzed
- ✅ N+1 queries eliminated

---

### TEST-COMPATIBILITY-001: Browser Compatibility

**Priority:** P1 (High)  
**Type:** Cross-Browser Test

**Browsers to Test:**

| Browser | Versions         | Platform |
| ------- | ---------------- | -------- |
| Chrome  | Latest, Latest-1 | Desktop  |
| Firefox | Latest, Latest-1 | Desktop  |
| Safari  | Latest, Latest-1 | macOS    |
| Edge    | Latest           | Desktop  |
| Chrome  | Latest           | Android  |
| Safari  | Latest           | iOS      |

**Test Cases:**

- ✅ All form inputs work
- ✅ Password visibility toggle
- ✅ OAuth popups/redirects
- ✅ Session persistence
- ✅ Auto-complete behavior
- ✅ Responsive design

**Tools:**

- BrowserStack / Sauce Labs for cross-browser testing
- Lighthouse for performance audits

---

### TEST-COMPATIBILITY-002: Mobile Responsiveness

**Priority:** P1 (High)  
**Type:** Responsive Design Test

**Devices to Test:**

- iPhone 14 Pro (390×844)
- iPhone SE (375×667)
- Samsung Galaxy S21 (360×800)
- iPad (768×1024)
- iPad Pro (1024×1366)

**Test Cases:**

- ✅ Forms usable on mobile
- ✅ Input fields not cut off
- ✅ Buttons easily tappable (min 44×44px)
- ✅ No horizontal scrolling
- ✅ Font size readable (min 16px for inputs)
- ✅ OAuth redirect works on mobile
- ✅ Keyboard doesn't break layout

**Accessibility:**

- Zoom to 200% works
- Screen reader compatible
- High contrast mode support

---

## Edge Cases and Error Scenarios

### TEST-EDGE-001: Network Timeout Scenarios

**Priority:** P1 (High)  
**Type:** Error Handling Test

**Test Cases:**

1. **Slow Network**
   - Throttle to 3G speeds
   - Attempt login
   - Verify loading states and timeouts

2. **Network Disconnected**
   - Disconnect network mid-login
   - Observe error handling

3. **Intermittent Connection**
   - Simulate spotty WiFi
   - Test retry logic

**Expected Results:**

- ✅ Timeout after 30 seconds
- ✅ User-friendly error: "Network timeout. Please check your connection."
- ✅ Retry button available
- ✅ Form data preserved
- ✅ No partial state corruption

**Implementation:**

```typescript
try {
  const response = await fetch("/api/login", {
    signal: AbortSignal.timeout(30000), // 30s timeout
  });
} catch (error) {
  if (error.name === "TimeoutError") {
    showError("Network timeout. Please try again.");
  }
}
```

---

### TEST-EDGE-002: Server Error Handling

**Priority:** P1 (High)  
**Type:** Error Handling Test

**HTTP Error Codes to Test:**

| Status Code | Scenario              | Expected UI                               |
| ----------- | --------------------- | ----------------------------------------- |
| 500         | Internal server error | "Something went wrong. Please try again." |
| 502         | Bad gateway           | "Service temporarily unavailable"         |
| 503         | Service unavailable   | "Under maintenance. Back soon."           |
| 504         | Gateway timeout       | "Request timed out. Please try again."    |

**Test Steps:**

1. Mock API to return each error code
2. Attempt login/signup
3. Observe error handling

**Expected Results:**

- ✅ User-friendly error messages
- ✅ No technical jargon
- ✅ Retry mechanism
- ✅ Error logged for debugging
- ✅ Support link provided

---

### TEST-EDGE-003: Concurrent User Registrations

**Priority:** P2 (Medium)  
**Type:** Race Condition Test

**Scenario:**
Two users simultaneously signup with same email

**Test Steps:**

1. Initiate 2 parallel signup requests with identical email
2. Observe race condition handling

**Expected Results:**

- ✅ Only one account created
- ✅ Both requests handled gracefully
- ✅ No database deadlock
- ✅ Clear error for second request
- ✅ Database constraint prevents duplicate

**Database Constraint:**

```sql
ALTER TABLE auth.users
ADD CONSTRAINT users_email_unique UNIQUE (email);
```

---

### TEST-EDGE-004: Special Characters in Inputs

**Priority:** P2 (Medium)  
**Type:** Input Validation Test

**Special Characters to Test:**

```typescript
const specialChars = {
  email: [
    "user+tag@example.com", // Plus addressing
    "user.name@example.com", // Dots
    "user_name@example.com", // Underscore
    "user123@subdomain.example.com", // Subdomain
    "user@example.co.uk", // Multi-part TLD
  ],
  name: [
    "O'Connor", // Apostrophe
    "Jean-Pierre", // Hyphen
    "José María", // Accents
    "Müller", // Umlauts
    "李明", // Chinese characters
    "Владимир", // Cyrillic
  ],
};
```

**Expected Results:**

- ✅ Valid characters accepted
- ✅ Unicode support
- ✅ Proper encoding/decoding
- ✅ No data corruption

---

### TEST-EDGE-005: Extremely Long Input Values

**Priority:** P2 (Medium)  
**Type:** Boundary Test

**Test Cases:**

| Field     | Max Length | Test Value        | Expected |
| --------- | ---------- | ----------------- | -------- |
| Email     | 254        | 255-char email    | Reject   |
| Password  | 128        | 129-char password | Reject   |
| Full Name | 100        | 101-char name     | Reject   |

**Expected Results:**

- ✅ Max length enforced (frontend + backend)
- ✅ Clear error message
- ✅ No buffer overflow
- ✅ Database constraint prevents storage

**Implementation:**

```typescript
const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(100),
});
```

---

### TEST-EDGE-006: Incomplete Form Submission

**Priority:** P2 (Medium)  
**Type:** UX Test

**Test Scenarios:**

1. **Partial Fill**
   - Fill only email
   - Click submit
   - Verify validation

2. **Empty Submission**
   - Submit completely empty form
   - Verify all fields flagged

3. **Browser Autofill**
   - Use browser autofill
   - Verify all fields populated

**Expected Results:**

- ✅ Required fields marked
- ✅ First error focused
- ✅ Inline validation messages
- ✅ Form not submitted until valid

---

### TEST-EDGE-007: Session Expiry During Use

**Priority:** P1 (High)  
**Type:** Session Management Test

**Test Steps:**

1. Login to application
2. Wait for session to expire (or mock expiry)
3. Attempt action requiring authentication

**Expected Results:**

- ✅ User prompted to re-authenticate
- ✅ Modal or redirect to login
- ✅ After re-auth, return to original action
- ✅ No data loss
- ✅ Graceful UX

**Implementation:**

```typescript
// Auto refresh before expiry
useEffect(() => {
  const refreshInterval = setInterval(
    async () => {
      const { data } = await supabase.auth.refreshSession();
      if (!data.session) {
        // Session expired
        showReauthModal();
      }
    },
    50 * 60 * 1000,
  ); // 50 minutes (before 1-hour expiry)

  return () => clearInterval(refreshInterval);
}, []);
```

---

### TEST-EDGE-008: Database Connectivity Issues

**Priority:** P1 (High)  
**Type:** Error Handling Test

**Test Scenarios:**

1. **Database Offline**
   - Simulate DB connection failure
   - Attempt login

2. **Connection Pool Exhausted**
   - Max connections reached
   - New request comes in

3. **Slow Queries**
   - Database overloaded
   - Queries taking > 5 seconds

**Expected Results:**

- ✅ Retry logic (3 attempts with exponential backoff)
- ✅ Circuit breaker pattern (stop after repeated failures)
- ✅ Graceful degradation
- ✅ User-friendly error message
- ✅ Alerts sent to ops team

---

### TEST-EDGE-009: Third-Party Service Outages

**Priority:** P1 (High)  
**Type:** Integration Test

**Services to Test:**

1. **OAuth Providers**
   - Google OAuth down
   - Expected: Fallback to email/password, error message

2. **Email Service**
   - Email provider down
   - Expected: Queue emails, retry later

3. **Password Breach API**
   - Have I Been Pwned down
   - Expected: Skip check, log warning

**Expected Results:**

- ✅ Graceful fallback
- ✅ User can still complete core action
- ✅ Non-blocking degradation
- ✅ Monitoring alerts

---

### TEST-EDGE-010: Clock Skew / Time Zone Issues

**Priority:** P3 (Low)  
**Type:** Edge Case Test

**Test Scenarios:**

1. **Client Clock Ahead**
   - Set client time +2 hours
   - Attempt login with MFA TOTP

2. **Client Clock Behind**
   - Set client time -2 hours
   - Attempt login

3. **Server Clock Skew**
   - Server time drifted
   - Token expiry issues

**Expected Results:**

- ✅ TOTP allows ±1 time step (30s)
- ✅ Token expiry uses server time
- ✅ Timestamps stored in UTC
- ✅ NTP sync on servers

---

## Test Automation

### Unit Test Suite

**Location:** `src/services/__tests__/`

**Coverage Target:** 90%

**Key Test Files:**

- `AuthService.signup.test.ts` (406 lines, 100% coverage)
- `AuthService.login.test.ts` (321 lines, 100% coverage)
- `AuthService.password.test.ts` (password reset flows)
- `AuthService.session.test.ts` (session management)
- `AuthService.oauth.test.ts` (OAuth flows)
- `auth.security.test.ts` (278 lines, security tests)
- `auth.integration.test.ts` (269 lines, integration tests)

**Run Tests:**

```bash
# All auth tests
npm test -- src/services/__tests__/Auth

# Specific test file
npm test -- src/services/__tests__/AuthService.signup.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

---

### Component Test Suite

**Location:** `src/views/Auth/__tests__/`

**Key Test Files:**

- `LoginPage.test.tsx` (335 lines)
- `SignupPage.test.tsx`
- `ResetPasswordPage.test.tsx`
- `AuthCallback.test.tsx` (OAuth callback)

**Run Tests:**

```bash
npm test -- src/views/Auth/__tests__/
```

---

### E2E Test Suite

**Tool:** Playwright / TestCafe

**Test Scenarios:**

```typescript
// tests/e2e/auth-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Complete Authentication Flow", () => {
  test("new user signup and login", async ({ page }) => {
    // 1. Navigate to signup
    await page.goto("http://localhost:5173/signup");

    // 2. Fill signup form
    const randomEmail = `test${Date.now()}@example.com`;
    await page.fill('[name="email"]', randomEmail);
    await page.fill('[name="password"]', "SecurePass123!");
    await page.fill('[name="confirmPassword"]', "SecurePass123!");
    await page.fill('[name="fullName"]', "Test User");
    await page.check('[name="acceptTerms"]');

    // 3. Submit form
    await page.click('button[type="submit"]');

    // 4. Verify redirect
    await expect(page).toHaveURL("/verify-email");

    // 5. Simulate email verification (direct DB update or API call)
    // ...

    // 6. Navigate to login
    await page.goto("http://localhost:5173/login");

    // 7. Login with new credentials
    await page.fill('[name="email"]', randomEmail);
    await page.fill('[name="password"]', "SecurePass123!");
    await page.click('button[type="submit"]');

    // 8. Verify successful login
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });
});
```

**Run E2E Tests:**

```bash
# All E2E tests
npx playwright test

# Specific test
npx playwright test auth-flow.spec.ts

# Headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

---

### Security Test Suite

**Tool:** OWASP ZAP (Zed Attack Proxy)

**Automated Security Scans:**

```bash
# Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5173 \
  -r security-report.html
```

**Security Tests:**

- SQL Injection scanning
- XSS detection
- CSRF token validation
- Security headers check
- SSL/TLS configuration
- Authentication bypass attempts

---

### Load Test Suite

**Tool:** k6

**Location:** `tests/load/auth-load-test.js`

**Run Load Tests:**

```bash
# Light load (100 users)
k6 run --vus 100 --duration 5m tests/load/auth-load-test.js

# Heavy load (500 users)
k6 run --vus 500 --duration 10m tests/load/auth-load-test.js

# Stress test (ramp up)
k6 run tests/load/auth-stress-test.js

# View results in Grafana
k6 run --out influxdb=http://localhost:8086 tests/load/auth-load-test.js
```

---

### Continuous Integration

**GitHub Actions Workflow:**

```yaml
# .github/workflows/auth-tests.yml
name: Authentication Tests

on:
  push:
    branches: [main, develop]
    paths:
      - "src/services/AuthService.ts"
      - "src/views/Auth/**"
      - "src/security/**"
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- src/services/__tests__/Auth --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install

      - name: Run E2E tests
        run: npx playwright test auth-flow.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run OWASP ZAP scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: "http://localhost:5173"
```

---

## Acceptance Criteria

### Definition of Done

A test is considered complete when:

- ✅ **Test Case Written** - Documented with steps and expected results
- ✅ **Test Implemented** - Automated test code written
- ✅ **Test Passing** - Executes successfully
- ✅ **Code Reviewed** - Peer review completed
- ✅ **CI Integrated** - Runs in CI/CD pipeline
- ✅ **Documentation Updated** - Test plan reflects current state

---

### Coverage Requirements

| Area               | Unit Test | Integration Test | E2E Test | Security Test |
| ------------------ | --------- | ---------------- | -------- | ------------- |
| **Account Setup**  | 90%+      | 100%             | 100%     | 100%          |
| **Login Process**  | 90%+      | 100%             | 100%     | 100%          |
| **Password Reset** | 90%+      | 100%             | 100%     | N/A           |
| **MFA**            | 90%+      | 100%             | 100%     | 100%          |
| **OAuth**          | 80%+      | 100%             | 100%     | 100%          |
| **Session Mgmt**   | 90%+      | 100%             | 80%      | 100%          |

---

### Quality Gates

**Required for Production Deploy:**

- ✅ All P0 tests passing
- ✅ All P1 tests passing
- ✅ 90%+ code coverage
- ✅ 0 critical security issues
- ✅ Load test performance within SLA
- ✅ E2E tests passing in staging
- ✅ Security scan clean

**Nice to Have:**

- All P2 tests passing
- All P3 tests passing
- 95%+ code coverage
- Browser compatibility validated

---

## Test Execution Plan

### Phase 1: Unit Testing (Week 1)

**Goal:** Achieve 90% code coverage on core auth services

**Tasks:**

- Review existing unit tests
- Identify coverage gaps
- Write missing unit tests
- Achieve 90% coverage target
- Document test cases

**Success Criteria:**

- All unit tests passing
- Coverage reports generated
- CI integration complete

---

### Phase 2: Integration Testing (Week 2)

**Goal:** Validate all service integrations

**Tasks:**

- Test Supabase Auth integration
- Test email service integration
- Test OAuth provider integration
- Test database operations
- Test rate limiting

**Success Criteria:**

- All integration tests passing
- No service failures
- Error handling validated

---

### Phase 3: E2E Testing (Week 3)

**Goal:** Validate complete user journeys

**Tasks:**

- Implement Playwright test suite
- Test signup → verify → login flow
- Test password reset flow
- Test OAuth flows
- Test MFA enrollment

**Success Criteria:**

- All user journeys automated
- Tests run in CI/CD
- Screenshots/videos captured

---

### Phase 4: Security Testing (Week 4)

**Goal:** Identify and fix security vulnerabilities

**Tasks:**

- Run OWASP ZAP scans
- Manual penetration testing
- Security code review
- Fix identified issues
- Retest

**Success Criteria:**

- 0 critical vulnerabilities
- 0 high vulnerabilities
- Security report generated
- Fixes verified

---

### Phase 5: Performance Testing (Week 5)

**Goal:** Validate performance under load

**Tasks:**

- Configure k6 load tests
- Run baseline tests
- Run stress tests
- Identify bottlenecks
- Optimize and retest

**Success Criteria:**

- < 1s avg response time (100 users)
- < 2s avg response time (500 users)
- < 0.1% error rate
- Performance report generated

---

### Phase 6: UAT (User Acceptance Testing) (Week 6)

**Goal:** Validate with real users

**Tasks:**

- Recruit beta testers
- Provide test accounts
- Collect feedback
- Fix usability issues
- Retest

**Success Criteria:**

- 95%+ user satisfaction
- All critical bugs fixed
- Documentation updated
- Ready for production

---

## Test Maintenance

### Ongoing Activities

**Weekly:**

- Review test failures
- Update flaky tests
- Add tests for new features

**Monthly:**

- Review test coverage
- Archive obsolete tests
- Update test documentation

**Quarterly:**

- Security audit
- Performance baseline
- Test suite optimization

---

## Appendix A: Test Data

### Valid Test Credentials

```typescript
// tests/fixtures/auth-credentials.ts
export const VALID_USERS = [
  {
    email: "admin@example.com",
    password: "AdminPass123!@#",
    role: "super_admin",
    mfaEnabled: true,
  },
  {
    email: "user@example.com",
    password: "UserPass123!@#",
    role: "user",
    mfaEnabled: false,
  },
  {
    email: "guest@example.com",
    password: "GuestPass123!@#",
    role: "guest",
    mfaEnabled: false,
  },
];
```

---

## Appendix B: Test Environments

### Local Development

- **URL:** `http://localhost:5173`
- **Database:** Local Supabase instance
- **Email:** Captured in logs (not sent)

### Staging

- **URL:** `https://staging.valueos.com`
- **Database:** Staging Supabase project
- **Email:** Test email service (Mailtrap)

### Production

- **URL:** `https://app.valueos.com`
- **Database:** Production Supabase project
- **Email:** Production email service (SendGrid)

---

## Appendix C: Tools and Dependencies

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0",
    "k6": "^0.47.0",
    "@axe-core/playwright": "^4.8.0",
    "msw": "^2.0.0"
  }
}
```

---

**Document Revision History:**

| Version | Date       | Author  | Changes                         |
| ------- | ---------- | ------- | ------------------------------- |
| 1.0     | 2026-01-08 | QA Team | Initial comprehensive test plan |

---

**Approval:**

- [ ] QA Lead
- [ ] Engineering Manager
- [ ] Security Officer
- [ ] Product Manager
