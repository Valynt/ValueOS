/**
 * Admin Navigation Tree
 *
 * Defines the Information Architecture for the Admin / Settings control plane.
 * Each section maps to a top-level category in the left rail.
 * Permission gates control visibility per role.
 *
 * See: docs/architecture/admin-settings-ia.md
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Scope at which a setting applies.
 * Used for visual badges and inheritance chain display.
 */
export type SettingScope = 'platform' | 'tenant' | 'workspace' | 'user';

/**
 * Admin permission required to view/edit a section.
 * Maps to fine-grained permission sets, not raw TenantRole.
 */
export type AdminPermission =
  | 'governance.read'
  | 'governance.write'
  | 'identity.read'
  | 'identity.write'
  | 'security.read'
  | 'security.write'
  | 'agents.read'
  | 'agents.write'
  | 'data.read'
  | 'data.write'
  | 'compliance.read'
  | 'compliance.write'
  | 'billing.read'
  | 'billing.write'
  | 'platform.read'
  | 'platform.write';

/**
 * Sensitivity level determines confirmation UX:
 * - normal: save button
 * - sensitive: re-authentication required
 * - destructive: type-to-confirm modal
 */
export type SensitivityLevel = 'normal' | 'sensitive' | 'destructive';

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  /** Permission required to see this item */
  requiredPermission: AdminPermission;
  /** Scope badge to display */
  scope: SettingScope;
  /** Whether changes generate audit events */
  audited: boolean;
  /** Sensitivity level for confirmation UX */
  sensitivity: SensitivityLevel;
  /** Description shown in search results and tooltips */
  description: string;
  /** Minimum plan tier required (null = all plans) */
  minPlanTier?: 'basic' | 'pro' | 'enterprise';
}

export interface AdminNavSection {
  id: string;
  label: string;
  icon: string;
  /** Permission required to see this section in the left rail */
  requiredPermission: AdminPermission;
  items: AdminNavItem[];
}

// ============================================================================
// Navigation Tree
// ============================================================================

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  // ---- 1. Governance ----
  {
    id: 'governance',
    label: 'Governance',
    icon: 'building',
    requiredPermission: 'governance.read',
    items: [
      {
        id: 'governance-org',
        label: 'Organization Profile',
        path: '/admin/governance/organization',
        requiredPermission: 'governance.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Organization name, domain, and profile settings',
      },
      {
        id: 'governance-boundaries',
        label: 'Tenant Boundaries',
        path: '/admin/governance/boundaries',
        requiredPermission: 'governance.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Data residency, namespace isolation, and tenant limits',
      },
      {
        id: 'governance-workspaces',
        label: 'Workspaces',
        path: '/admin/governance/workspaces',
        requiredPermission: 'governance.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Create and manage workspaces within the organization',
      },
      {
        id: 'governance-entitlements',
        label: 'Feature Entitlements',
        path: '/admin/governance/entitlements',
        requiredPermission: 'governance.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'View features available on your plan tier',
      },
      {
        id: 'governance-environments',
        label: 'Environment Controls',
        path: '/admin/governance/environments',
        requiredPermission: 'governance.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Production, staging, and sandbox environment configuration',
        minPlanTier: 'enterprise',
      },
    ],
  },

  // ---- 2. Identity & Access ----
  {
    id: 'identity',
    label: 'Identity & Access',
    icon: 'users',
    requiredPermission: 'identity.read',
    items: [
      {
        id: 'identity-users',
        label: 'Users',
        path: '/admin/identity/users',
        requiredPermission: 'identity.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Manage organization members and invitations',
      },
      {
        id: 'identity-roles',
        label: 'Roles',
        path: '/admin/identity/roles',
        requiredPermission: 'identity.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Define and assign roles with permission sets',
      },
      {
        id: 'identity-policies',
        label: 'Role Policies',
        path: '/admin/identity/policies',
        requiredPermission: 'identity.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Configure permission boundaries and policy constraints',
        minPlanTier: 'pro',
      },
      {
        id: 'identity-delegation',
        label: 'Delegated Administration',
        path: '/admin/identity/delegation',
        requiredPermission: 'identity.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Delegate admin capabilities to workspace-level administrators',
        minPlanTier: 'enterprise',
      },
      {
        id: 'identity-reviews',
        label: 'Access Reviews',
        path: '/admin/identity/reviews',
        requiredPermission: 'identity.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Periodic access review campaigns for compliance',
        minPlanTier: 'enterprise',
      },
    ],
  },

  // ---- 3. Security Posture ----
  {
    id: 'security',
    label: 'Security Posture',
    icon: 'shield',
    requiredPermission: 'security.read',
    items: [
      {
        id: 'security-sso',
        label: 'SSO Configuration',
        path: '/admin/security/sso',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Configure SAML/OIDC single sign-on providers',
        minPlanTier: 'enterprise',
      },
      {
        id: 'security-mfa',
        label: 'MFA Enforcement',
        path: '/admin/security/mfa',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Enforce multi-factor authentication for all users',
      },
      {
        id: 'security-sessions',
        label: 'Password & Session Policies',
        path: '/admin/security/sessions',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Password complexity, session timeout, and idle policies',
      },
      {
        id: 'security-api-keys',
        label: 'API Keys',
        path: '/admin/security/api-keys',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Create, rotate, and revoke API keys',
      },
      {
        id: 'security-webhooks',
        label: 'Webhook Secrets',
        path: '/admin/security/webhook-secrets',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Manage webhook signing secrets and rotation',
      },
      {
        id: 'security-export',
        label: 'Data Export Controls',
        path: '/admin/security/export',
        requiredPermission: 'security.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'destructive',
        description: 'Control data export capabilities and restrictions',
      },
    ],
  },

  // ---- 4. Agent Governance ----
  {
    id: 'agents',
    label: 'Agent Governance',
    icon: 'bot',
    requiredPermission: 'agents.read',
    items: [
      {
        id: 'agents-registry',
        label: 'Agent Registry',
        path: '/admin/agents/registry',
        requiredPermission: 'agents.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'View and manage enabled agents, their status, and execution environment',
      },
      {
        id: 'agents-models',
        label: 'Model Policies',
        path: '/admin/agents/model-policies',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Allowed models, fallback rules, and enterprise model gating',
      },
      {
        id: 'agents-tools',
        label: 'Tool Access Controls',
        path: '/admin/agents/tool-access',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Approved integrations per agent, API allowlists, data classification',
      },
      {
        id: 'agents-guardrails',
        label: 'Execution Guardrails',
        path: '/admin/agents/guardrails',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'destructive',
        description: 'Max steps, rate limits, token budgets, and human review triggers',
      },
      {
        id: 'agents-confidence',
        label: 'Confidence & Veto Policies',
        path: '/admin/agents/confidence',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'destructive',
        description: 'Minimum confidence thresholds, integrity veto rules, auto-escalation',
      },
      {
        id: 'agents-costs',
        label: 'Cost & Rate Controls',
        path: '/admin/agents/costs',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Per-agent budget caps, alert thresholds, auto-disable on breach',
      },
      {
        id: 'agents-retention',
        label: 'Data Retention Rules',
        path: '/admin/agents/retention',
        requiredPermission: 'agents.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Log retention windows, artifact retention, redaction policies',
      },
    ],
  },

  // ---- 5. Data & Integrations ----
  {
    id: 'data',
    label: 'Data & Integrations',
    icon: 'plug',
    requiredPermission: 'data.read',
    items: [
      {
        id: 'data-integrations',
        label: 'External Integrations',
        path: '/admin/data/integrations',
        requiredPermission: 'data.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Connect external services and data sources',
      },
      {
        id: 'data-webhooks',
        label: 'Webhooks',
        path: '/admin/data/webhooks',
        requiredPermission: 'data.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Configure outbound event webhook subscriptions',
      },
      {
        id: 'data-pipelines',
        label: 'Data Pipelines',
        path: '/admin/data/pipelines',
        requiredPermission: 'data.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Manage data ingestion and transformation pipelines',
        minPlanTier: 'pro',
      },
      {
        id: 'data-storage',
        label: 'Storage & Retention',
        path: '/admin/data/storage',
        requiredPermission: 'data.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Storage quotas, retention policies, and data lifecycle',
      },
      {
        id: 'data-events',
        label: 'Event Destinations',
        path: '/admin/data/events',
        requiredPermission: 'data.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Route domain events to external systems',
        minPlanTier: 'pro',
      },
    ],
  },

  // ---- 6. Compliance & Audit ----
  {
    id: 'compliance',
    label: 'Compliance & Audit',
    icon: 'file-check',
    requiredPermission: 'compliance.read',
    items: [
      {
        id: 'compliance-audit-logs',
        label: 'Audit Logs',
        path: '/admin/compliance/audit-logs',
        requiredPermission: 'compliance.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'View and export activity logs for compliance and forensics',
      },
      {
        id: 'compliance-policy-history',
        label: 'Policy History',
        path: '/admin/compliance/policy-history',
        requiredPermission: 'compliance.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'Track all policy and configuration changes over time',
      },
      {
        id: 'compliance-retention',
        label: 'Retention Schedule',
        path: '/admin/compliance/retention',
        requiredPermission: 'compliance.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'destructive',
        description: 'Configure data and log retention schedules',
      },
      {
        id: 'compliance-dsr',
        label: 'Data Subject Requests',
        path: '/admin/compliance/dsr',
        requiredPermission: 'compliance.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'destructive',
        description: 'Process GDPR data subject access and deletion requests',
        minPlanTier: 'pro',
      },
      {
        id: 'compliance-mode',
        label: 'Compliance Mode',
        path: '/admin/compliance/mode',
        requiredPermission: 'compliance.write',
        scope: 'tenant',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Enable SOC2, GDPR, or HIPAA compliance modes',
        minPlanTier: 'enterprise',
      },
    ],
  },

  // ---- 7. Billing & Usage ----
  {
    id: 'billing',
    label: 'Billing & Usage',
    icon: 'credit-card',
    requiredPermission: 'billing.read',
    items: [
      {
        id: 'billing-plan',
        label: 'Plan Tier',
        path: '/admin/billing/plan',
        requiredPermission: 'billing.read',
        scope: 'tenant',
        audited: true,
        sensitivity: 'normal',
        description: 'Current plan, upgrade options, and contract details',
      },
      {
        id: 'billing-usage',
        label: 'Usage Overview',
        path: '/admin/billing/usage',
        requiredPermission: 'billing.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'Current utilization, included limits, and forecasted overage',
      },
      {
        id: 'billing-agent-costs',
        label: 'Agent Cost Breakdown',
        path: '/admin/billing/agent-costs',
        requiredPermission: 'billing.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'Per-agent spend, model cost distribution, tool/API attribution',
      },
      {
        id: 'billing-overage',
        label: 'Overage Policy',
        path: '/admin/billing/overage',
        requiredPermission: 'billing.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'Overage formula, escalation triggers, and throttling behavior',
      },
      {
        id: 'billing-rate-limits',
        label: 'Rate Limits & Throttling',
        path: '/admin/billing/rate-limits',
        requiredPermission: 'billing.read',
        scope: 'tenant',
        audited: false,
        sensitivity: 'normal',
        description: 'Current rate limits, grace periods, and what happens at capacity',
      },
    ],
  },

  // ---- 8. Platform (Internal Only) ----
  {
    id: 'platform',
    label: 'Platform',
    icon: 'server',
    requiredPermission: 'platform.read',
    items: [
      {
        id: 'platform-tenants',
        label: 'Tenant Registry',
        path: '/admin/platform/tenants',
        requiredPermission: 'platform.write',
        scope: 'platform',
        audited: true,
        sensitivity: 'destructive',
        description: 'View and manage all tenants across the platform',
      },
      {
        id: 'platform-overrides',
        label: 'Cross-Tenant Overrides',
        path: '/admin/platform/overrides',
        requiredPermission: 'platform.write',
        scope: 'platform',
        audited: true,
        sensitivity: 'destructive',
        description: 'Override tenant-level settings from the platform level',
      },
      {
        id: 'platform-flags',
        label: 'Feature Flags',
        path: '/admin/platform/feature-flags',
        requiredPermission: 'platform.write',
        scope: 'platform',
        audited: true,
        sensitivity: 'sensitive',
        description: 'Manage feature flag rollouts across tenants',
      },
      {
        id: 'platform-incidents',
        label: 'Incident Controls',
        path: '/admin/platform/incidents',
        requiredPermission: 'platform.write',
        scope: 'platform',
        audited: true,
        sensitivity: 'destructive',
        description: 'Emergency controls: tenant suspension, agent kill switches, rate overrides',
      },
    ],
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get all nav items flattened (for search)
 */
export function getAllNavItems(): AdminNavItem[] {
  return ADMIN_NAV_SECTIONS.flatMap((section) => section.items);
}

/**
 * Find a nav item by path
 */
export function findNavItemByPath(path: string): AdminNavItem | undefined {
  return getAllNavItems().find((item) => item.path === path);
}

/**
 * Find the parent section for a nav item
 */
export function findSectionForItem(itemId: string): AdminNavSection | undefined {
  return ADMIN_NAV_SECTIONS.find((section) =>
    section.items.some((item) => item.id === itemId)
  );
}

/**
 * Build breadcrumbs for a given path
 */
export function buildBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const item = findNavItemByPath(path);
  if (!item) return [];

  const section = findSectionForItem(item.id);
  if (!section) return [{ label: item.label, path: item.path }];

  return [
    { label: section.label, path: section.items[0]?.path ?? path },
    { label: item.label, path: item.path },
  ];
}

/**
 * Filter sections and items by permissions
 */
export function filterByPermissions(
  permissions: Set<AdminPermission>,
  planTier?: 'free' | 'basic' | 'pro' | 'enterprise'
): AdminNavSection[] {
  const tierRank: Record<string, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };
  const currentRank = tierRank[planTier ?? 'free'] ?? 0;

  return ADMIN_NAV_SECTIONS
    .filter((section) => permissions.has(section.requiredPermission))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!permissions.has(item.requiredPermission)) return false;
        if (item.minPlanTier && tierRank[item.minPlanTier] > currentRank) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Search nav items by query string
 */
export function searchNavItems(
  query: string,
  permissions: Set<AdminPermission>
): AdminNavItem[] {
  const lower = query.toLowerCase();
  return getAllNavItems().filter(
    (item) =>
      permissions.has(item.requiredPermission) &&
      (item.label.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower))
  );
}

/**
 * Scope display configuration
 */
export const SCOPE_CONFIG: Record<SettingScope, { label: string; color: string; description: string }> = {
  platform: {
    label: 'Platform Scope',
    color: 'bg-gray-900 text-white',
    description: 'Applies to all tenants. Platform admin only.',
  },
  tenant: {
    label: 'Tenant Scope',
    color: 'bg-blue-100 text-blue-800',
    description: 'Applies to all workspaces in this organization.',
  },
  workspace: {
    label: 'Workspace Override',
    color: 'bg-purple-100 text-purple-800',
    description: 'Overrides the tenant default for this workspace.',
  },
  user: {
    label: 'User Scope',
    color: 'bg-gray-100 text-gray-600',
    description: 'Personal preference. Does not affect other users.',
  },
};
