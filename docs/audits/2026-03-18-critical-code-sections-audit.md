# Security Audit: 10 Most Critical Code Sections

**Date:** 2026-03-18
**Auditor:** Code Audit (automated + manual review)
**Scope:** Security-critical modules in `packages/shared` and `apps/ValyntApp`

---

## Executive Summary

This audit reviewed the 10 most security-critical sections of the ValueOS codebase, focusing on authentication, authorization, tenant isolation, input validation, and infrastructure security. The review identified **3 high-severity** and **5 medium-severity** findings, of which 3 have been directly fixed in this PR and 5 are documented as recommendations for follow-up.

### Severity Classification
- **CRITICAL**: Exploitable vulnerability that could lead to data breach or unauthorized access
- **HIGH**: Security weakness that could be exploited under specific conditions
- **MEDIUM**: Defense-in-depth gap or architectural concern
- **LOW**: Code quality issue with minor security implications
- **INFO**: Observation or recommendation

---

## Sections Audited

| # | File | Area | Verdict |
|---|------|------|---------|
| 1 | `apps/ValyntApp/src/security/ssrfGuard.ts` | SSRF Protection | **FIXED** |
| 2 | `apps/ValyntApp/src/security/CSRFProtection.ts` | CSRF Token Handling | **FIXED** |
| 3 | `packages/shared/src/lib/tenantVerification.ts` | Tenant Isolation | **WARNING ADDED** |
| 4 | `apps/ValyntApp/src/security/RateLimiter.ts` | Rate Limiting | **WARNING ADDED** |
| 5 | `packages/shared/src/lib/adminSupabase.ts` | Admin DB Access | PASS |
| 6 | `packages/shared/src/lib/supabase.ts` | DB Client Creation | PASS |
| 7 | `packages/shared/src/lib/piiFilter.ts` | PII Log Filtering | PASS (with notes) |
| 8 | `apps/ValyntApp/src/security/InputSanitizer.ts` | Input Sanitization | PASS (with notes) |
| 9 | `apps/ValyntApp/src/security/CORSValidator.ts` | CORS Policy | PASS |
| 10 | `packages/shared/src/lib/env.ts` | Environment/Secrets | PASS |

---

## Findings

### FINDING-01: SSRF Guard Placeholder Domain [HIGH] -- FIXED

**File:** `apps/ValyntApp/src/security/ssrfGuard.ts:5`
**Status:** Fixed in this PR

The SSRF guard allowlist contained a placeholder domain `.yourdomain.com`. If deployed to production, this would allow outbound requests to any subdomain of `yourdomain.com`, effectively creating a permissive SSRF bypass.

**Fix applied:** Removed the placeholder domain. Only `.supabase.co` remains in the allowlist. A comment instructs developers to add the actual production domain when ready.

---

### FINDING-02: SSRF Guard IPv4-Mapped IPv6 Bypass [HIGH] -- FIXED

**File:** `apps/ValyntApp/src/security/ssrfGuard.ts:60-85`
**Status:** Fixed in this PR

The `isPrivateIp()` function did not check for:
- **IPv4-mapped IPv6 addresses** (e.g., `::ffff:127.0.0.1`, `::ffff:10.0.0.1`) -- an attacker could use these to bypass IPv4 private range checks
- **Cloud metadata endpoint** (`169.254.169.254`) -- used by AWS/GCP/Azure to expose instance credentials
- **CGNAT range** (`100.64.0.0/10`) -- could be used to reach internal services
- **Unspecified address** (`0.0.0.0`, `::`) -- could resolve to localhost
- **IPv6 ULA range** (`fd00::/8`) -- only `fc00::` prefix was checked

The `BLOCKED_IP_RANGES` constant was also defined but never used, with hardcoded string checks used instead.

**Fix applied:** Completely rewrote `isPrivateIp()` and extracted `isPrivateIpv4()`:
- Added full IPv4-mapped IPv6 detection covering all valid representations:
  - Dotted-quad form: `::ffff:127.0.0.1`
  - Hex compact form: `::ffff:7f00:1`
  - Full expanded form: `0:0:0:0:0:ffff:7f00:1`
  - Zero-padded form: `0000:0000:0000:0000:0000:ffff:7f00:0001`
- Added `expandIpv6()` helper to normalize :: shorthand into 8 groups
- Added `extractIpv4FromMappedIpv6()` to decode the last 32 bits of mapped addresses
- Added cloud metadata range (`169.254.0.0/16`)
- Added CGNAT range (`100.64.0.0/10`)
- Added `0.0.0.0/8` (unspecified)
- Added `fd00::/8` (IPv6 ULA upper half)
- Added `::` (IPv6 unspecified)
- Proper octet parsing with validation
- Removed unused `BLOCKED_IP_RANGES` constant (logic is now inline)

---

### FINDING-03: CSRF Token Timing Attack [HIGH] -- FIXED

**File:** `apps/ValyntApp/src/security/CSRFProtection.ts:163`
**Status:** Fixed in this PR

The CSRF token validation used JavaScript's `!==` operator for string comparison:
```typescript
if (storedToken.token !== token) {
```

This is vulnerable to timing attacks. The `!==` operator short-circuits on the first mismatched character, meaning an attacker can measure response times to deduce the correct token one character at a time.

**Fix applied:** Added a `constantTimeEqual()` function that XORs all character codes and checks the accumulated result, ensuring comparison time is independent of token content. The function also handles length mismatches without early return.

---

### FINDING-04: Client-Side Only Rate Limiting [MEDIUM] -- WARNING ADDED

**File:** `apps/ValyntApp/src/security/RateLimiter.ts`
**Status:** Warning comment added; architectural fix recommended

The rate limiter uses:
- An in-memory `Map` for storage (lost on page refresh)
- `window.setInterval` for cleanup (browser-only)
- No server-side enforcement

This means rate limiting can be completely bypassed by:
1. Disabling JavaScript
2. Calling APIs directly (curl, Postman, etc.)
3. Refreshing the page to clear state

**Recommendation:** Implement a server-side rate limiter backed by Redis (the project already has `packages/shared/src/lib/redisClient.ts`). The client-side limiter should remain as a UX convenience only, not a security control.

---

### FINDING-05: Tenant Verification Uses Anon Client [MEDIUM] -- WARNING ADDED

**File:** `packages/shared/src/lib/tenantVerification.ts:34`
**Status:** Warning comment added; architectural fix recommended

The `verifyTenantMembership()` function dynamically imports the browser/anon Supabase client to check tenant membership. This means the check depends on Row Level Security (RLS) policies being correctly configured on the `user_tenants` and `users` tables.

If RLS is misconfigured (e.g., overly permissive SELECT policies), a user could potentially verify membership in tenants they don't belong to. For server-side authorization decisions, a service-role client should be used to make authoritative checks independent of RLS.

**Positive notes:** The function correctly fails closed (returns `false` on any error), logs cross-tenant access attempts with high severity, and masks user IDs in logs.

---

### FINDING-06: PII Filter Partial Redaction in Development [LOW]

**File:** `packages/shared/src/lib/piiFilter.ts:158-159`
**Status:** Informational

In development mode, the first 4 characters of sensitive values are shown:
```typescript
if (isDevelopment() && valueStr.length > 4) {
  return `[REDACTED:${valueStr.substring(0, 4)}...]`;
}
```

While useful for debugging, this could leak partial secrets if development logs are accidentally captured, exported, or shipped. Consider using a separate opt-in verbose mode rather than tying partial redaction to the development environment.

---

### FINDING-07: Input Sanitizer Overly Aggressive SQL Detection [LOW]

**File:** `apps/ValyntApp/src/security/InputSanitizer.ts:48-54`
**Status:** Informational

The SQL injection patterns match common English words:
```typescript
/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
/(\bOR\b.*=.*)/gi,
/(\bAND\b.*=.*)/gi,
/('|"|;|\||&)/g,
```

This produces false positives on legitimate input (e.g., "SELECT the best option", "Tom's report", semicolons in text). Since the application uses Supabase (which uses parameterized queries by default), SQL injection via application-level input is already mitigated. The pattern detection adds noise without real protection.

**Recommendation:** Remove the SQL detection patterns from the general `sanitizeString` function. Parameterized queries are the correct defense against SQL injection, not input pattern matching.

---

### FINDING-08: Admin Supabase Audit Logs In-Memory Only [MEDIUM]

**File:** `packages/shared/src/lib/adminSupabase.ts:21-22`
**Status:** Informational

Admin client access is logged to an in-memory array capped at 1000 entries:
```typescript
const callerLog: Array<{ caller: string; timestamp: string }> = [];
const MAX_LOG_ENTRIES = 1000;
```

In production, these audit logs are lost on process restart and are never persisted. For SOC 2 compliance, admin/service-role access should be logged to a durable store (database table, external logging service).

**Positive notes:** The browser guard (`typeof window !== "undefined"`) is correctly implemented, and the client requires both URL and service role key.

---

## Positive Findings

The following patterns were found to be well-implemented:

1. **Fail-closed design in tenant verification** -- All error paths return `false` (deny access)
2. **Browser/server boundary guards** -- Admin and server clients check for browser context and throw
3. **Request-scoped Supabase clients** -- `createRequestSupabaseClient()` correctly uses the user's JWT token
4. **CORS validation** -- Prevents wildcard origin with credentials (CSRF vector)
5. **PII filtering** -- Comprehensive sensitive field detection with recursive object sanitization
6. **Security headers** -- CSP, HSTS, X-Frame-Options, Permissions-Policy all properly configured
7. **Redis TLS enforcement** -- Production Redis connections require TLS with certificate verification
8. **Permission system** -- Clean role-based model with explicit permission grants per role
9. **DOMPurify for HTML sanitization** -- Industry-standard library for XSS prevention
10. **Service role key protection** -- Required in production, never exposed to browser

---

## Recommendations Summary

| Priority | Finding | Action |
|----------|---------|--------|
| Immediate | FINDING-01, 02, 03 | **Done** -- Fixed in this PR |
| High | FINDING-04 | Implement Redis-backed server-side rate limiter |
| High | FINDING-05 | Use service-role client for server-side tenant verification |
| Medium | FINDING-08 | Persist admin access audit logs to database |
| Low | FINDING-06 | Separate verbose redaction from dev environment check |
| Low | FINDING-07 | Remove SQL pattern detection from input sanitizer |
