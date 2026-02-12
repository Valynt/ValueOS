# Admin / Settings Information Architecture

## Status: Proposal (v1)

## Problem

The current settings surface mixes user preferences with org-level controls, buries security settings, treats agents as features instead of governed systems, and doesn't scale to enterprise tenants with 100+ users. The IA conflates environment-level and tenant-level settings.

Current state:
- `SettingsLayout.tsx` uses flat horizontal tabs: Profile, Security, Billing, Notifications, Team, Branding, Integrations
- `SettingsView.tsx` routes to 3 scopes (user/team/organization) but the hierarchy is implicit
- `settingsMatrix.ts` defines 6 config categories with access control, but the UI doesn't reflect this structure
- `settingsRegistry.ts` is a stub — no real routing, breadcrumbs, or scope resolution
- Agent governance has no dedicated surface

## IA Model: Enterprise Control Plane

### Top-Level Navigation (Left Rail)

```
1. Governance
   ├── Organization Profile
   ├── Tenant Boundaries
   ├── Workspaces
   ├── Feature Entitlements
   └── Environment Controls

2. Identity & Access
   ├── Users
   ├── Roles
   ├── Role Policies
   ├── Delegated Administration
   └── Access Reviews

3. Security Posture
   ├── SSO Configuration
   ├── MFA Enforcement
   ├── Password & Session Policies
   ├── API Keys
   ├── Webhook Secrets
   └── Data Export Controls

4. Agent Governance
   ├── Agent Registry
   ├── Model Policies
   ├── Tool Access Controls
   ├── Execution Guardrails
   ├── Confidence & Veto Policies
   ├── Cost & Rate Controls
   └── Data Retention Rules

5. Data & Integrations
   ├── External Integrations
   ├── Webhooks
   ├── Data Pipelines
   ├── Storage & Retention
   └── Event Destinations

6. Compliance & Audit
   ├── Audit Logs
   ├── Policy History
   ├── Retention Schedule
   ├── Data Subject Requests
   └── Compliance Mode

7. Billing & Usage
   ├── Plan Tier
   ├── Usage Overview
   ├── Agent Cost Breakdown
   ├── Overage Policy
   └── Rate Limits & Throttling

8. Platform (Internal Only)
   ├── Tenant Registry
   ├── Cross-Tenant Overrides
   ├── Feature Flags
   └── Incident Controls
```

### Why These Groupings

| Category | Rationale |
|---|---|
| Governance | Structural authority — who owns what. Separated from feature config. |
| Identity & Access | The perimeter. Not a sub-feature of organization. |
| Security Posture | Authentication, key material, session controls. Isolated from business logic. |
| Agent Governance | Agents are regulated actors, not features. Cost, risk, and autonomy controls. |
| Data & Integrations | All external connections grouped to expose risk surface. |
| Compliance & Audit | What happened, not how it's configured. Visibility layer. |
| Billing & Usage | Cost and throttling transparency. Operational, not cosmetic. |
| Platform | Internal-only. Invisible to tenant admins. |

### Mental Model

Admins think in layers:
1. Who has authority?
2. What is the security posture?
3. What automation is allowed?
4. What data leaves the system?
5. What is the cost impact?
6. What is the audit trail?

The IA mirrors this order.

## Hierarchy Model

### Four Scopes

| Scope | Visibility | Visual Indicator |
|---|---|---|
| **Global (Platform)** | Platform Super Admin only | Dark badge: "Platform Scope", non-editable for tenant admins |
| **Tenant** | Org Admin, Security Admin, etc. | Blue badge: "Tenant Scope", "Applies to all workspaces" label, lock icon on inherited settings |
| **Workspace** | Workspace admins | Purple badge: "Workspace Override", inline note: "Overrides Tenant Default" |
| **User** | Individual user | Gray badge: "User Scope", never co-mingled with org settings |

### Scope Communication

- Scope badge at page header
- Inheritance chain display (shows where a value comes from)
- Lock icon + tooltip explaining source
- Change log entry shows scope
- Prevents configuration drift

### Mapping to Existing Code

The `settingsMatrix.ts` `CONFIGURATION_ACCESS_MATRIX` already defines `tenantAdmin` vs `vendorAdmin` access levels. The UI must surface this:

| `settingsMatrix` category | IA section |
|---|---|
| `multi_tenant` | Governance |
| `iam` | Identity & Access |
| `ai_orchestration` | Agent Governance |
| `operational` | Data & Integrations + Platform |
| `security` | Security Posture + Compliance & Audit |
| `billing` | Billing & Usage |

## Agent Governance (Detail)

### Agent Registry
- Enable/disable per agent
- Status: Active / Suspended / Experimental
- Execution environment assignment
- Maps to `AgentTogglesConfig` in `settingsMatrix.ts`

### Model Policies
- Allowed models per agent
- Fallback rules
- Enterprise-only model gating
- Maps to `ModelRoutingConfig` in `settingsMatrix.ts`

### Tool Access Controls
- Approved integrations per agent
- External API allowlist
- Data classification restrictions

### Execution Guardrails
- Max steps per run
- Rate limits
- Max token budget per request
- Human review triggers
- Maps to `HITLThresholdsConfig` and `RateLimitingConfig`

### Confidence & Veto Policies
- Minimum confidence threshold
- Integrity veto required before output publish
- Auto-escalation rules
- Maps to `HITLThresholdsConfig` and `ManifestoStrictnessConfig`

### Cost & Rate Controls
- Per-agent budget caps
- Alert thresholds
- Auto-disable on breach
- Maps to `LLMSpendingLimitsConfig`

### Data Retention Rules
- Log retention window
- Artifact retention
- Redaction policies
- Maps to `RetentionPoliciesConfig`

### Risk Prevention

| Risk | Mitigation |
|---|---|
| Rogue configuration | Dual confirmation for guardrail reductions. Mandatory reason for override. Audit entry on all guardrail edits. |
| Shadow automation | All agent executions logged. "Hidden agent" detection (disabled but referenced). Feature flag visibility. |
| Silent cost blowups | Real-time budget usage display. Hard caps with enforcement. Email + webhook alerts. |

## Security & Compliance Architecture

### Re-Authentication Required

These settings require password re-entry or WebAuthn before modification:
- SSO configuration changes
- MFA enforcement changes
- API key regeneration
- Data export enablement
- Webhook secret rotation

### Dual Confirmation Required

These settings require a second confirmation step (type-to-confirm or approval workflow):
- Disabling MFA enforcement
- Reducing confidence thresholds
- Lowering data retention windows
- Disabling audit logging
- Raising cost caps beyond plan defaults

### Audit Event Generation

All of these changes generate audit entries with: who, what changed, old value, new value, scope, timestamp.
- Role policy edits
- Agent guardrail changes
- Billing plan changes
- API key creation/deletion
- Workspace creation/deletion

### Mapping to Existing Code

- `AuditTrailService` (`packages/backend/src/services/security/AuditTrailService.ts`) handles audit logging
- `AuthPolicyConfig` and `SessionControlConfig` in `settingsMatrix.ts` define the policy types
- `SecretRotationConfig` covers key rotation
- RLS policies enforce tenant isolation at the database level

## Billing & Usage Model

Not a billing portal. An operational cost dashboard.

### Structure

| Section | Content |
|---|---|
| Usage Overview | Plan tier, included limits, current utilization, forecasted overage risk |
| Agent Cost Breakdown | Per-agent spend, model spend distribution, tool/API spend attribution |
| Throttling Behavior | What happens at limit, grace period rules, automatic downgrade policy |
| Overage Policy | Explicit formula, escalation triggers, contract reference for enterprise |

### Design Principles
- Tabular, not chart-heavy
- Transparent formulas
- No animated vanity charts
- CFO-safe: every number traceable

### Mapping to Existing Code

- `TokenDashboardConfig`, `ValueMeteringConfig`, `SubscriptionPlanConfig`, `InvoicingConfig` in `settingsMatrix.ts`
- `LLMSpendingLimitsConfig` for agent cost controls
- Agent cost tracking via `agent_runs` table

## Navigation & Interaction Model

### Pattern: Left Rail + Context Panel

- **Left rail**: Stable categories (the 8 top-level sections)
- **Main pane**: Content area
- **Right contextual panel**: Audit trail, help, policy references (optional, collapsible)

### Design Decisions

| Feature | Decision | Rationale |
|---|---|---|
| Navigation | Left rail, not tabs | Tabs don't scale past 7 items. Left rail supports nested sections. |
| Nesting | Max 2 levels deep | Deeper nesting causes disorientation. Use collapsible sections within pages. |
| Search | Command-style ("Jump to: SSO configuration") | Must respect permissions — don't show items the user can't access. |
| Breadcrumbs | `Governance > Agent Governance > Execution Guardrails` | Always reflects scope. |
| URLs | Deep-linkable, stable | Every subsection has a stable URL. Enables audit replay and bookmarking. |

### URL Structure

```
/admin/governance/organization
/admin/governance/workspaces
/admin/identity/users
/admin/identity/roles
/admin/security/sso
/admin/security/mfa
/admin/agents/registry
/admin/agents/model-policies
/admin/agents/guardrails
/admin/data/integrations
/admin/data/webhooks
/admin/compliance/audit-logs
/admin/compliance/retention
/admin/billing/overview
/admin/billing/agent-costs
/admin/platform/tenants          (internal only)
/admin/platform/feature-flags    (internal only)
```

### Migration from Current Routes

| Current Route | New Route |
|---|---|
| `/user/profile` | `/settings/profile` (user settings, separate from admin) |
| `/user/security` | `/settings/security` |
| `/organization/general` | `/admin/governance/organization` |
| `/organization/members` | `/admin/identity/users` |
| `/organization/roles` | `/admin/identity/roles` |
| `/organization/security` | `/admin/security/sso` + `/admin/security/mfa` |
| `/organization/billing` | `/admin/billing/overview` |
| `/team/permissions` | `/admin/identity/roles` (workspace-scoped) |
| `/team/audit-logs` | `/admin/compliance/audit-logs` |

User-level settings (`/settings/*`) remain separate from admin (`/admin/*`). This is the scope separation.

## Accessibility & Enterprise Readiness

### Keyboard Navigation
- Full tree navigable with arrow keys
- Enter activates
- Escape closes modals
- No tab traps in nested sections

### Screen Reader
- Section groups use `role="group"` with `aria-label`
- Scope badges announced via `aria-describedby`
- Confirmation dialogs explicitly state impact

### Destructive Actions
- Red text + warning icon
- Plain-language impact explanation
- "Type to confirm" for irreversible actions (e.g., disabling MFA, deleting API keys)

### Silent Failure Patterns to Avoid
- Saving without visible confirmation
- Scope override without warning
- Changing inherited setting without awareness
- Hidden throttling behavior
- Feature silently disabled due to plan downgrade

## Alternatives

### Option A: Conservative Enterprise Model

Classic left-rail categories, minimal nesting. Static navigation.

| Pros | Cons |
|---|---|
| Familiar to enterprise admins | Can feel static |
| Predictable | Less adaptive to plan/role variation |
| Easy to audit | May show irrelevant sections to some roles |

### Option B: Scalable Control-Plane Model (Recommended)

Dynamic navigation based on permissions and feature flags. Sections appear/disappear based on role and plan tier.

| Pros | Cons |
|---|---|
| Flexible | Harder mental model if sections move |
| Future-proof | Must avoid "menu moving" confusion |
| Cleaner per-role surface | Requires permission-aware navigation |

### Option C: Modular Admin App

Separate Admin application mounted inside main product (micro-frontend).

| Pros | Cons |
|---|---|
| Clean separation of concerns | Context switching |
| Independent release cycle | Perceived as separate product |
| Clear governance boundary | Requires cross-app state sync |

## Refinement Questions

These questions would meaningfully change the architecture:

1. **SMB vs Enterprise weight** — Is the primary customer base SMB (< 50 users) or Enterprise (500+ users)? This determines whether we optimize for simplicity or governance depth.

2. **Sub-tenant management** — Do tenants manage sub-tenants (e.g., a consulting firm managing client orgs)? This adds a hierarchy level and changes the scope model.

3. **Agent configuration authority** — Is agent configuration self-serve (tenant admins configure freely) or centrally controlled (platform team sets guardrails, tenants operate within them)? This determines whether Agent Governance is read-only or read-write for tenant admins.

4. **Air-gapped / on-prem requirements** — Do customers require on-prem or air-gapped deployment? This affects whether Platform-level settings need to be exposed to tenant admins in isolated environments.

5. **Settings change frequency** — How frequently do admins change settings? Daily (needs fast access) vs quarterly (needs safety rails and confirmation flows)?

## Role Model Gap

The IA assumes admin role types that don't exist in the current codebase:

| IA Role | Current Equivalent | Gap |
|---|---|---|
| Org Admin | `TenantRole: "owner"` or `"admin"` | Exists, but not fine-grained |
| Security Admin | None | New role needed |
| Billing Admin | None | New role needed |
| Agent Ops Admin | None | New role needed |
| Auditor (read-only) | `ValueRole: "auditor"` | Exists in `settingsMatrix.ts` but not in `TenantRole` |
| Platform Super Admin | `vendorAdmin` access level | Exists as access level, not as a role |

The current `TenantRole` (`owner | admin | member | viewer`) is too coarse for the IA's permission model. Options:

1. **Extend `TenantRole`** — Add `security_admin`, `billing_admin`, `agent_ops_admin`, `auditor` to the union type
2. **Composite permissions** — Keep `TenantRole` coarse, add fine-grained permission sets that map to IA sections
3. **Role + Permission hybrid** — `TenantRole` for base access, `SettingsPermission[]` for section-level gates

Option 2 is recommended. It avoids role explosion and maps cleanly to the `CONFIGURATION_ACCESS_MATRIX`.

## Audit Trail Integration

The existing `AuditTrailService` supports `configuration_change` events with:
- `actorId`, `actorType` (user/agent/system)
- `resourceId`, `resourceType`
- `details` (JSONB — can store old/new values)
- `correlationId` for tracing
- `tenantId` for scope
- `complianceFlags` for SOC2/GDPR tagging

Every admin setting change should emit a `configuration_change` audit event with:
```typescript
{
  eventType: 'configuration_change',
  action: 'admin.agents.guardrails.updated',
  details: {
    setting: 'maxTokenBudget',
    oldValue: 10000,
    newValue: 50000,
    scope: 'tenant',
    section: 'agent_governance',
    requiresReauth: false,
    dualConfirmed: true,
  }
}
```

## Implementation Mapping

### Files to Create

| File | Purpose |
|---|---|
| `apps/ValyntApp/src/pages/admin/AdminLayout.tsx` | Left-rail layout with scope-aware navigation |
| `apps/ValyntApp/src/pages/admin/AdminRouter.tsx` | Route definitions for `/admin/*` |
| `apps/ValyntApp/src/lib/adminNavigation.ts` | Navigation tree definition with permission gates |
| `apps/ValyntApp/src/components/admin/ScopeBadge.tsx` | Visual scope indicator component |
| `apps/ValyntApp/src/components/admin/SettingRow.tsx` | Row component with scope, lock, and audit indicators |
| `apps/ValyntApp/src/components/admin/ConfirmationModal.tsx` | Type-to-confirm destructive action modal |
| `apps/ValyntApp/src/hooks/useAdminPermissions.ts` | Permission-aware hook for admin sections |

### Files to Modify

| File | Change |
|---|---|
| `apps/ValyntApp/src/lib/settingsRegistry.ts` | Implement real routing, breadcrumbs, scope resolution |
| `apps/ValyntApp/src/contexts/SettingsContext.tsx` | Add scope awareness, admin vs user mode |
| `apps/ValyntApp/src/config/settingsMatrix.ts` | Add IA section mapping to each config entry |
| `apps/ValyntApp/src/pages/settings/SettingsLayout.tsx` | Redirect org-level routes to `/admin/*` |

### Backend Support

| File | Change |
|---|---|
| `packages/backend/src/api/admin.ts` | Add endpoints for admin settings CRUD with scope validation |
| `packages/backend/src/config/settingsMatrix.ts` | Mirror frontend IA section mapping |
| `packages/backend/src/services/AdminUserService.ts` | Add role-based setting access validation |
