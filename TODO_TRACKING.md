# TODO Items Tracking

This document tracks all TODO, FIXME, and technical debt items found in the codebase during the audit.

**Last Updated:** November 22, 2024  
**Total Items:** 24

---

## High Priority (Implement Soon)

### 1. Security: Remove unsafe-inline CSP Directive
**File:** `src/security/SecurityConfig.ts:241`  
**Issue:** Using `'unsafe-inline'` in Content Security Policy  
**Impact:** Security vulnerability, allows inline scripts  
**Action:** Refactor to use nonces or hashes for inline scripts  
**Effort:** 4 hours  
**Status:** 🔴 Open

```typescript
// Current
scriptSrc: ["'self'", "'unsafe-inline'"], // TODO: Remove unsafe-inline in production

// Target
scriptSrc: ["'self'", "'nonce-{RANDOM}'"],
```

### 2. Error Tracking Integration
**Files:**
- `src/sdui/components/ComponentErrorBoundary.tsx:113`
- `src/components/Agent/AgentErrorBoundary.tsx:100`
- `src/bootstrap.ts:210`

**Issue:** Error tracking service not integrated  
**Impact:** No centralized error monitoring in production  
**Action:** Integrate Sentry or similar service  
**Effort:** 6 hours  
**Status:** 🔴 Open

**Implementation Steps:**
1. Add Sentry SDK to dependencies
2. Configure Sentry in bootstrap
3. Update error boundaries to send to Sentry
4. Add source map upload to build process

---

## Medium Priority (Implement This Sprint)

### 3. Workflow Conditional Transitions
**File:** `src/services/workflows/WorkflowDAGIntegration.ts:385`  
**Issue:** Conditional transition evaluation not implemented  
**Impact:** Workflows cannot branch based on conditions  
**Action:** Implement condition evaluation logic  
**Effort:** 8 hours  
**Status:** 🟡 Open

```typescript
// TODO: Implement condition evaluation for conditional transitions
// Need to support:
// - Boolean expressions
// - Comparison operators
// - Variable substitution
```

### 4. Database Connection Health Check
**File:** `src/bootstrap.ts:290`  
**Issue:** Database connection not verified during bootstrap  
**Impact:** App may start without database connectivity  
**Action:** Add Supabase connection health check  
**Effort:** 2 hours  
**Status:** 🟡 Open

### 5. Redis Cache Initialization
**File:** `src/bootstrap.ts:310`  
**Issue:** Redis cache initialization not implemented  
**Impact:** Caching not available even when enabled  
**Action:** Implement Redis connection and initialization  
**Effort:** 4 hours  
**Status:** 🟡 Open

### 6. Selection Box Resize Functionality
**File:** `src/components/Canvas/SelectionBox.tsx:19`  
**Issue:** Resize functionality not implemented  
**Impact:** Users cannot resize selection boxes  
**Action:** Implement resize handles and logic  
**Effort:** 6 hours  
**Status:** 🟡 Open

---

## Low Priority (Technical Debt)

### 7-20. Tenant Provisioning Database Calls
**File:** `src/services/TenantProvisioning.ts`  
**Lines:** 301, 327, 341, 352, 363, 405, 546  
**Issue:** Database calls stubbed with TODOs  
**Impact:** Tenant provisioning not functional  
**Action:** Implement Supabase database operations  
**Effort:** 16 hours total  
**Status:** 🟢 Planned

**Affected Methods:**
- `createTenant()` - Line 301
- `initializeTenantSettings()` - Line 327
- `getTenant()` - Line 341
- `listTenants()` - Line 352
- `updateTenant()` - Line 363
- `getTenantUsage()` - Line 405
- `updateTenantStatus()` - Line 546

### 21-22. Tenant Provisioning Integrations
**File:** `src/services/TenantProvisioning.ts`  
**Lines:** 378, 513, 422, 562  
**Issue:** External integrations not implemented  
**Impact:** Billing and email notifications not functional  
**Action:** Integrate billing provider and email service  
**Effort:** 12 hours total  
**Status:** 🟢 Planned

**Integrations Needed:**
- Billing integration (Lines 378, 513)
- Email sending (Lines 422, 562)
- Data archival (Line 521)
- Access revocation (Line 532)

### 23-25. Usage Tracking Database Operations
**File:** `src/services/UsageTrackingService.ts`  
**Lines:** 146, 273, 328  
**Issue:** Database operations stubbed  
**Impact:** Usage tracking not persisted  
**Action:** Implement Supabase database operations  
**Effort:** 6 hours  
**Status:** 🟢 Planned

**Affected Methods:**
- `getUsageForPeriod()` - Line 146
- `recordUsage()` - Line 273
- `getUsageByResource()` - Line 328

---

## Summary by Category

### Security (High Priority)
- [ ] Remove unsafe-inline CSP directive (4 hours)
- [ ] Integrate error tracking (6 hours)

**Total:** 10 hours

### Core Functionality (Medium Priority)
- [ ] Implement workflow conditional transitions (8 hours)
- [ ] Add database health check (2 hours)
- [ ] Initialize Redis cache (4 hours)
- [ ] Implement selection box resize (6 hours)

**Total:** 20 hours

### Enterprise Features (Low Priority)
- [ ] Implement tenant provisioning database calls (16 hours)
- [ ] Integrate billing and email services (12 hours)
- [ ] Implement usage tracking persistence (6 hours)

**Total:** 34 hours

---

## Implementation Plan

### Week 1: Security & Monitoring
1. **Day 1-2:** Remove unsafe-inline CSP (4 hours)
2. **Day 3-4:** Integrate Sentry error tracking (6 hours)

### Week 2: Core Functionality
3. **Day 1-2:** Workflow conditional transitions (8 hours)
4. **Day 3:** Database health check (2 hours)
5. **Day 4:** Redis cache initialization (4 hours)
6. **Day 5:** Selection box resize (6 hours)

### Week 3-4: Enterprise Features
7. **Week 3:** Tenant provisioning (16 hours)
8. **Week 4:** Billing/email integration (12 hours)
9. **Week 4:** Usage tracking (6 hours)

**Total Estimated Effort:** 64 hours (8 days)

---

## GitHub Issues to Create

### High Priority Issues

**Issue #1: Remove unsafe-inline from CSP**
```markdown
## Description
Remove `'unsafe-inline'` from Content Security Policy scriptSrc directive.

## Current Behavior
CSP allows inline scripts, creating security vulnerability.

## Expected Behavior
Use nonces or hashes for inline scripts.

## Files Affected
- src/security/SecurityConfig.ts

## Acceptance Criteria
- [ ] Remove unsafe-inline from CSP
- [ ] Implement nonce generation
- [ ] Update inline scripts to use nonces
- [ ] Test CSP in production build

## Effort
4 hours

## Priority
High - Security
```

**Issue #2: Integrate Error Tracking Service**
```markdown
## Description
Integrate Sentry or similar error tracking service for production monitoring.

## Current Behavior
Errors are only logged to console, no centralized tracking.

## Expected Behavior
All errors sent to Sentry with context and user information.

## Files Affected
- src/bootstrap.ts
- src/sdui/components/ComponentErrorBoundary.tsx
- src/components/Agent/AgentErrorBoundary.tsx

## Acceptance Criteria
- [ ] Add Sentry SDK dependency
- [ ] Configure Sentry in bootstrap
- [ ] Update error boundaries
- [ ] Add source map upload
- [ ] Test error reporting

## Effort
6 hours

## Priority
High - Monitoring
```

### Medium Priority Issues

**Issue #3: Implement Workflow Conditional Transitions**
```markdown
## Description
Implement condition evaluation for workflow conditional transitions.

## Current Behavior
Conditional transitions are not evaluated, workflows cannot branch.

## Expected Behavior
Workflows can branch based on boolean conditions.

## Files Affected
- src/services/workflows/WorkflowDAGIntegration.ts

## Acceptance Criteria
- [ ] Implement condition parser
- [ ] Support boolean expressions
- [ ] Support comparison operators
- [ ] Support variable substitution
- [ ] Add tests for condition evaluation

## Effort
8 hours

## Priority
Medium - Core Functionality
```

**Issue #4: Add Database Health Check**
```markdown
## Description
Add Supabase connection health check during bootstrap.

## Current Behavior
App starts without verifying database connectivity.

## Expected Behavior
Bootstrap fails if database is unreachable.

## Files Affected
- src/bootstrap.ts

## Acceptance Criteria
- [ ] Implement Supabase health check
- [ ] Add to bootstrap sequence
- [ ] Handle connection failures gracefully
- [ ] Add retry logic

## Effort
2 hours

## Priority
Medium - Reliability
```

### Low Priority Issues

**Issue #5: Implement Tenant Provisioning**
```markdown
## Description
Implement database operations for tenant provisioning service.

## Current Behavior
Tenant provisioning methods are stubbed with TODOs.

## Expected Behavior
Full tenant lifecycle management with database persistence.

## Files Affected
- src/services/TenantProvisioning.ts

## Acceptance Criteria
- [ ] Implement createTenant database call
- [ ] Implement getTenant database call
- [ ] Implement listTenants database call
- [ ] Implement updateTenant database call
- [ ] Implement getTenantUsage database call
- [ ] Add tests for all methods

## Effort
16 hours

## Priority
Low - Enterprise Feature
```

---

## Tracking Progress

Update this document as TODOs are resolved:

- ✅ **Completed** - Item implemented and tested
- 🚧 **In Progress** - Currently being worked on
- 🔴 **Open (High)** - High priority, needs immediate attention
- 🟡 **Open (Medium)** - Medium priority, schedule soon
- 🟢 **Open (Low)** - Low priority, technical debt

---

## Notes

1. **Security items** should be prioritized for production deployment
2. **Core functionality** items block feature completeness
3. **Enterprise features** can be implemented incrementally
4. All TODOs should have corresponding GitHub issues
5. Update this document when new TODOs are added

---

**Maintained by:** Development Team  
**Review Frequency:** Weekly  
**Next Review:** November 29, 2024
