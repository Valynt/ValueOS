# Tenant Settings & Configuration Review

**Date**: January 5, 2026  
**Status**: Architecture Review Complete  
**Reviewer**: Ona AI Agent

---

## Executive Summary

ValueOS exposes a comprehensive multi-tier settings system to tenants through a hierarchical configuration architecture. The system follows Enterprise SaaS best practices with tenant isolation, role-based access control, and cascading configuration overrides.

**Architecture Rating**: ⭐⭐⭐⭐ (4/5)  
**Security Rating**: ⭐⭐⭐⭐⭐ (5/5)  
**Type Safety Rating**: ⭐⭐⭐ (3/5)

---

## Settings Architecture Overview

### Three-Tier Hierarchy

```
┌─────────────────────────────────────┐
│   Organization-Level Settings       │  ← Highest Authority
│   (Billing, Security, Compliance)   │
└─────────────────────────────────────┘
              ↓ inherits
┌─────────────────────────────────────┐
│   Team/Workspace-Level Settings     │  ← Mid-Level
│   (Permissions, Workflows)          │
└─────────────────────────────────────┘
              ↓ inherits
┌─────────────────────────────────────┐
│   User-Level Settings               │  ← Individual Preferences
│   (Theme, Notifications, Language)  │
└─────────────────────────────────────┘
```

### Configuration Cascade Priority

1. **User-level override** (highest priority)
2. **Team-level override**
3. **Organization-level override**
4. **System default** (lowest priority)

---

## Exposed Settings by Tier

### 1. User-Level Settings

**Location**: `src/views/Settings/UserProfile.tsx`, `UserSecurity.tsx`, `UserAppearance.tsx`, `UserNotifications.tsx`

#### Profile Settings
- **Full Name** - User's display name
- **Display Name** - Username/handle (@username)
- **Email** - Read-only, managed by auth system
- **Phone Number** - Optional contact
- **Job Title** - Optional role description
- **Avatar** - Profile photo (max 5MB)

#### Security Settings
- **Password Management**
  - Current password verification
  - New password with strength validation
  - Password policy enforcement (min 8 chars, uppercase, lowercase, numbers)
- **Multi-Factor Authentication (MFA)**
  - TOTP setup via QR code
  - Backup codes generation (10 codes)
  - Recovery options
- **WebAuthn/Passkeys**
  - Hardware key registration
  - Biometric authentication
- **Active Sessions**
  - View all active sessions
  - Device type, browser, OS, location
  - Revoke individual sessions
  - "Sign out all other sessions"

#### Appearance Settings (Placeholder)
- Theme (light/dark/system)
- Language preference
- Accessibility options

#### Notification Settings (Placeholder)
- Email notifications
- Push notifications
- Slack/Teams integration
- In-app notifications

---

### 2. Team/Workspace-Level Settings

**Location**: `src/views/Settings/TeamSettings.tsx`, `TeamPermissions.tsx`, `TeamAuditLog.tsx`

#### General Settings (Placeholder)
- Workspace name
- Workspace icon
- Basic configuration

#### Member Management (Placeholder)
- Invite members
- Manage member list
- Member roles

#### Permissions
- Role-based access control
- Custom permission sets
- Resource-level permissions

#### Workflow Settings
- **Notification Preferences**
  - Mentions notifications
  - Task assignments
  - Weekly digest
  - Project updates
  - Email notifications
  - Slack notifications
- **Workflow Configuration**
  - Default task status
  - Require approval for actions
  - Auto-archive settings (days)
  - Default assignee

#### Integrations (Placeholder)
- Third-party app connections
- API integrations

#### Settings Import/Export
- Export workspace settings as JSON
- Import settings from file
- Version tracking

#### Audit Logs
- View team activity
- Filter by action type
- Export audit trail

---

### 3. Organization-Level Settings

**Location**: `src/views/Settings/OrganizationGeneral.tsx`, `OrganizationUsers.tsx`, `OrganizationRoles.tsx`, `OrganizationSecurity.tsx`, `OrganizationBilling.tsx`

#### Organization Identity
- **Organization Name** - Company/org name
- **Domain** - Primary domain (validated format)
- **Industry** - Industry classification
- **Organization Size** - Employee count range
- **Logo** - Organization logo (max 5MB)
- **Brand Colors**
  - Primary color (hex)
  - Secondary color (hex)
  - Live theme preview

#### Member Management
- **User List**
  - Email, name, role, department
  - Status (active/invited/suspended/deactivated)
  - Last login tracking
  - Group memberships
- **User Actions**
  - Invite new users
  - Edit user details
  - Change roles
  - Suspend/reactivate users
  - Remove users

#### Role Management
- **Predefined Roles**
  - Admin - Full system access
  - Manager - Team management
  - Member - Standard access
- **Custom Roles**
  - Create custom roles
  - Define permissions
  - Assign to users
- **Permission Categories**
  - Organization management
  - Member management
  - Team management
  - Billing management
  - API/webhook management
  - Integration management
  - Security management
  - Audit log access

#### Security Settings
- **Authentication Policy**
  - Enforce MFA for all users
  - Require WebAuthn
  - Enable passwordless login
  - Password policy configuration
    - Minimum length
    - Require uppercase
    - Require lowercase
    - Require numbers
    - Require special characters
- **Session Control**
  - Session timeout (minutes)
  - Idle timeout (minutes)
  - Max concurrent sessions
- **SSO Configuration** (Placeholder)
  - SAML/OIDC setup
  - Identity provider integration
- **IP Whitelisting** (Placeholder)
  - Allowed IP ranges
  - Geographic restrictions
- **Domain Management** (Placeholder)
  - Allowed email domains
  - Auto-provisioning rules

#### Billing & Subscription
- **Current Plan Display**
  - Plan name (Starter/Professional/Enterprise)
  - Monthly price
  - Included features
  - Next billing date
- **Plan Actions**
  - Upgrade plan
  - Cancel plan
- **Usage Metrics**
  - Active users (vs limit)
  - Storage used (GB, vs limit)
  - API calls (vs limit)
  - Usage percentage indicators
  - Color-coded warnings (>75% yellow, >90% red)
- **Billing History** (Placeholder)
  - Invoice list
  - Payment method
  - Billing email

#### Audit Logs (Placeholder)
- Organization-wide activity
- Compliance reporting
- Export capabilities

#### Integrations & API (Placeholder)
- API key management
- Webhook configuration
- Organization-wide integrations

---

## Database Schema

### Organization Configurations Table

**Table**: `organization_configurations`  
**Schema**: `supabase/migrations/20251230013534_organization_configurations.sql`

#### Configuration Categories

##### 1. Multi-Tenant & Organization Settings
```jsonb
tenant_provisioning: {
  status: "trial" | "active" | "suspended",
  maxUsers: number,
  maxStorageGB: number
}

custom_branding: {
  logo: string (URL),
  primaryColor: string (hex),
  secondaryColor: string (hex),
  fontFamily: string
}

data_residency: {
  primaryRegion: string (AWS region)
}

domain_management: {
  allowedDomains: string[],
  autoProvision: boolean
}

namespace_isolation: {
  enabled: boolean
}
```

##### 2. Identity & Access Management (IAM)
```jsonb
auth_policy: {
  enforceMFA: boolean,
  enableWebAuthn: boolean,
  enablePasswordless: boolean,
  passwordPolicy: {
    minLength: number,
    requireUppercase: boolean,
    requireLowercase: boolean,
    requireNumbers: boolean,
    requireSpecialChars: boolean
  }
}

sso_config: {
  provider: "saml" | "oidc",
  enabled: boolean,
  entityId: string,
  ssoUrl: string,
  certificate: string
}

session_control: {
  timeoutMinutes: number,
  idleTimeoutMinutes: number,
  maxConcurrentSessions: number
}

ip_whitelist: {
  allowedRanges: string[]
}
```

##### 3. AI Orchestration & Agent Fabric
```jsonb
llm_spending_limits: {
  monthlyHardCap: number,
  monthlySoftCap: number,
  perRequestLimit: number,
  alertThreshold: number (percentage),
  alertRecipients: string[]
}

model_routing: {
  defaultModel: string,
  routingRules: Array<{
    condition: string,
    targetModel: string
  }>,
  enableAutoDowngrade: boolean
}

agent_toggles: {
  enabledAgents: {
    opportunityAgent: boolean,
    targetAgent: boolean,
    assumptionAgent: boolean,
    riskAgent: boolean,
    valueAgent: boolean
  }
}

hitl_thresholds: {
  autoApprovalThreshold: number (0-1),
  humanReviewThreshold: number (0-1),
  rejectionThreshold: number (0-1),
  reviewers: string[]
}

ground_truth_sync: {
  enabled: boolean,
  syncFrequency: string
}

formula_versioning: {
  activeVersion: string,
  availableVersions: string[],
  autoUpdate: boolean
}
```

##### 4. Operational & Performance Settings
```jsonb
feature_flags: {
  enabledFeatures: Record<string, boolean>,
  betaFeatures: Record<string, boolean>
}

rate_limiting: {
  requestsPerMinute: number,
  requestsPerHour: number,
  requestsPerDay: number,
  burstAllowance: number
}

observability: {
  traceSamplingRate: number (0-1),
  logVerbosity: "debug" | "info" | "warn" | "error",
  enableMetrics: boolean,
  enableTracing: boolean
}

cache_management: {
  cacheTTL: number (seconds),
  enableCache: boolean,
  cacheStrategy: "lru" | "lfu"
}

webhooks: {
  endpoints: Array<{
    url: string,
    events: string[],
    secret: string
  }>
}
```

##### 5. Security, Audit & Governance
```jsonb
audit_integrity: {
  enableHashChaining: boolean,
  verificationFrequencyHours: number
}

retention_policies: {
  dataRetentionDays: number,
  logRetentionDays: number,
  auditRetentionDays: number,
  financialRetentionYears: number
}

manifesto_strictness: {
  mode: "warning" | "strict" | "off",
  enabledRules: string[]
}

secret_rotation: {
  autoRotation: boolean,
  rotationFrequencyDays: number
}

rls_monitoring: {
  enabled: boolean,
  alertOnViolations: boolean,
  performanceThresholdMs: number
}
```

##### 6. Billing & Usage Analytics
```jsonb
token_dashboard: {
  enableRealTime: boolean,
  refreshIntervalSeconds: number,
  showCostBreakdown: boolean
}

value_metering: {
  enabled: boolean,
  billableMilestones: string[],
  pricingModel: "per_user" | "per_usage"
}

subscription_plan: {
  tier: "free" | "starter" | "professional" | "enterprise",
  billingCycle: "monthly" | "annual",
  autoRenew: boolean
}

invoicing: {
  paymentMethod: "credit_card" | "invoice",
  billingEmail: string
}
```

---

## Security & Access Control

### Row-Level Security (RLS)

All settings tables have RLS enabled with tenant isolation:

```sql
-- Users can only access their organization's configuration
CREATE POLICY org_configs_tenant_isolation 
  ON organization_configurations
  FOR ALL
  USING (organization_id = current_setting('app.current_tenant_id', true)::UUID);

-- Vendor admins can access all configurations
CREATE POLICY org_configs_vendor_admin 
  ON organization_configurations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role') = 'vendor_admin'
    )
  );
```

### Permission System

**Permission Types**:
- `organization.manage` - Full org settings access
- `members.manage` - User management
- `team.manage` - Team/workspace management
- `billing.manage` - Billing and subscription
- `billing.view` - View billing info
- `api_keys.manage` - API key management
- `webhooks.manage` - Webhook configuration
- `integrations.manage` - Integration management
- `security.manage` - Security policy management
- `audit.view` - Audit log access
- `team.view` - View team settings

### Tenant Verification

**Module**: `src/lib/tenantVerification.ts`

**Key Functions**:
- `verifyTenantMembership(userId, tenantId)` - Verify user belongs to tenant
- `assertTenantMembership(userId, tenantId)` - Throws on failure
- `getUserTenantId(userId)` - Get user's organization ID
- `verifyTenantExists(tenantId)` - Check tenant is active
- `verifyRequestTenant(userId, tenantIdFromRequest)` - Middleware helper

**Security Features**:
- Fail-closed on errors (deny access)
- User ID masking in logs
- Cross-tenant access attempt logging
- Batch verification support

---

## Critical Issues Identified

### 🔴 HIGH PRIORITY

#### 1. Stale Closure Risk in State Updates

**Location**: All settings components using `updateSetting`

**Issue**: Checkbox handlers like `onChange={(e) => updateSetting('key', e.target.checked)}` may cause stale state overwrites if multiple rapid clicks occur.

**Impact**: User changes may be lost or overwritten

**Fix Required**:
```typescript
// Current (risky)
const updateSetting = (key: string, value: any) => {
  setValues({ ...values, [key]: value });
};

// Fixed (safe)
const updateSetting = (key: string, value: any) => {
  setValues(prev => ({ ...prev, [key]: value }));
};
```

#### 2. Nullish Boolean Trap

**Location**: All components using `?? true` or `?? false` for checkboxes

**Issue**: Database `null` vs UI default mismatch causes inconsistent state

**Example**:
```typescript
// Problematic
checked={values['user.notifications.email'] ?? true}
// DB: null → UI shows checked
// User unchecks → saves false
// User resets → UI shows true, DB still null
```

**Fix Required**: Ensure database migrations set explicit defaults, not null

#### 3. Schema Mismatch: Redundant Nesting

**Location**: `settingsRegistry` key mapping

**Issue**: Keys like `user.notifications.email` may be saved as:
```json
{
  "user": {
    "notifications": {
      "email": true
    }
  }
}
```
Inside a column already named `user_preferences`

**Fix Required**: Strip scope prefix before saving to JSONB

### 🟡 MEDIUM PRIORITY

#### 4. Missing Dependency Memoization

**Location**: All `useSettings` hook calls

**Issue**: Object literals in hook calls cause infinite re-renders:
```typescript
// Problematic
const { value } = useSettings('user.theme', { userId }, { scope: 'user' });
// { userId } is a new object on every render
```

**Fix Required**:
```typescript
const context = useMemo(() => ({ userId }), [userId]);
const { value } = useSettings('user.theme', context, { scope: 'user' });
```

#### 5. No Input Debouncing

**Location**: `OrganizationSecurity.tsx` - session timeout input

**Issue**: Every keystroke triggers a Supabase update

**Fix Required**: Add debouncing (300-500ms)

#### 6. TypeScript Type Safety

**Location**: All `values['key']` access patterns

**Issue**: Typos like `values['user.thme']` not caught by compiler

**Fix Required**:
```typescript
type UserSettingsKeys = 
  | 'user.theme' 
  | 'user.language' 
  | 'user.notifications.email';

const { values } = useSettingsGroup<UserSettingsKeys>([...]);
```

### 🟢 LOW PRIORITY

#### 7. Missing Loading States

**Location**: Various settings components

**Issue**: Some components don't show loading indicators during save

**Fix Required**: Add loading states to all async operations

#### 8. Inconsistent Error Handling

**Location**: Settings components

**Issue**: Some components handle errors, others don't

**Fix Required**: Standardize error handling pattern

---

## Recommendations

### Immediate Actions (Sprint 1)

1. **Fix State Updates** - Implement functional state updates in all hooks
2. **Database Defaults** - Add explicit defaults to all JSONB columns
3. **Key Mapping** - Implement scope prefix stripping in `settingsRegistry`
4. **Memoization** - Add `useMemo` to all context objects

### Short-term (Sprint 2-3)

5. **Type Safety** - Create discriminated union types for all setting keys
6. **Debouncing** - Add debouncing to numeric inputs
7. **Loading States** - Standardize loading indicators
8. **Error Handling** - Implement consistent error handling pattern

### Long-term (Future Sprints)

9. **Settings Validation** - Add Zod schemas for all settings
10. **Optimistic Updates** - Implement optimistic UI updates
11. **Undo/Redo** - Add undo capability for settings changes
12. **Settings History** - Track settings change history
13. **Bulk Operations** - Support bulk settings updates
14. **Settings Templates** - Pre-configured setting templates

---

## Testing Recommendations

### Unit Tests Required

- [ ] Settings cascade logic (user → team → org → default)
- [ ] Permission checks for each settings tier
- [ ] Validation logic for all input types
- [ ] State update race conditions
- [ ] Cache invalidation

### Integration Tests Required

- [ ] End-to-end settings update flow
- [ ] Cross-tenant isolation verification
- [ ] RLS policy enforcement
- [ ] Audit log generation
- [ ] Settings export/import

### Security Tests Required

- [ ] Cross-tenant access attempts
- [ ] Permission boundary violations
- [ ] SQL injection in JSONB queries
- [ ] XSS in custom branding fields
- [ ] Rate limiting enforcement

---

## API Endpoints

### Billing API

**Location**: `src/api/billing/subscriptions.ts`

**Endpoints**:
- `GET /api/billing/subscription` - Get current subscription
- `POST /api/billing/subscription` - Create subscription
- `PUT /api/billing/subscription` - Update subscription (upgrade/downgrade)

**Security**: All endpoints verify `tenantId` from request context

---

## Configuration Files

### Settings Registry

**Location**: `src/lib/settingsRegistry.ts`

**Features**:
- Route registration and navigation
- Breadcrumb generation
- Permission checking
- Search functionality

### Settings Context

**Location**: `src/contexts/SettingsContext.tsx`

**Provides**:
- Current route tracking
- Navigation helpers
- Search state
- Permission checking
- Breadcrumb data

---

## Conclusion

ValueOS has a well-architected settings system with strong security foundations. The identified issues are primarily implementation details that can be resolved without architectural changes. The system follows Enterprise SaaS best practices for multi-tenancy, security, and scalability.

**Priority**: Address HIGH priority issues before production deployment.

**Timeline**: 
- HIGH priority fixes: 1-2 sprints
- MEDIUM priority fixes: 2-3 sprints
- LOW priority improvements: Ongoing

---

## Appendix: Settings Inventory

### Complete Settings List

#### User Settings (15 total)
- Profile: name, displayName, email, phone, jobTitle, avatar
- Security: password, MFA, WebAuthn, sessions
- Appearance: theme, language, timezone, dateFormat, timeFormat
- Notifications: email, push, slack, inApp
- Accessibility: highContrast, fontSize, reducedMotion

#### Team Settings (10 total)
- General: name, icon
- Access: defaultRole, allowGuestAccess, requireApproval
- Notifications: mentions, updates
- Workflow: autoAssign, defaultPriority, autoArchive, archiveDays

#### Organization Settings (50+ total)
- Identity: name, domain, industry, size, logo, colors
- Members: user management, roles, groups
- Security: auth policy, MFA, SSO, sessions, IP whitelist
- Billing: plan, usage, payment
- AI: LLM limits, model routing, agent toggles, HITL
- Operations: feature flags, rate limits, observability, cache
- Governance: audit, retention, compliance, secrets

**Total Exposed Settings**: 75+

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Next Review**: February 5, 2026
