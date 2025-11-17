export interface CanvasComponent {
  id: string;
  type: 'metric-card' | 'interactive-chart' | 'data-table' | 'narrative-block';
  position: { x: number; y: number };
  size: { width: number; height: number };
  props: any;
  isSelected?: boolean;
}

export interface MetricCardProps {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  change?: string;
  tooltipId?: string;
}

export interface ChartData {
  name: string;
  value: number;
  id: string;
  color?: string;
}

export interface InteractiveChartProps {
  title: string;
  data: ChartData[];
  type: 'bar' | 'pie' | 'line';
  config?: {
    stack?: 'vertical' | 'horizontal';
    showValue?: boolean;
    showLegend?: boolean;
  };
}

export interface DataTableProps {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  editableColumns?: number[];
}

export interface NarrativeBlockProps {
  title: string;
  content: string;
  isEditable: boolean;
}

export interface AgentMessage {
  id: string;
  type: 'activity' | 'suggestion' | 'narrative';
  timestamp: Date;
  agent: string;
  title: string;
  content: string;
  actions?: Array<{ label: string; action: string }>;
}

export interface BusinessCase {
  id: string;
  name: string;
  client: string;
  status: 'draft' | 'in-review' | 'presented';
  components: CanvasComponent[];
  lastModified: Date;
}

export interface Case {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  created_at: Date;
  updated_at: Date;
  components_count: number;
  tags?: string[];
  status: 'draft' | 'review' | 'published';
}

export type ViewMode = 'library' | 'canvas' | 'opportunity' | 'target' | 'expansion' | 'integrity' | 'templates' | 'settings' | 'documentation';

export type SettingsTier = 'user' | 'team' | 'organization';

export type SettingsPermission =
  | 'organization.manage'
  | 'members.manage'
  | 'team.manage'
  | 'billing.manage'
  | 'api_keys.manage'
  | 'webhooks.manage'
  | 'integrations.manage'
  | 'security.manage'
  | 'audit.view'
  | 'billing.view'
  | 'webhooks.view'
  | 'api_keys.view'
  | 'team.view';

export interface SettingsRoute {
  id: string;
  path: string;
  label: string;
  description?: string;
  icon?: string;
  tier: SettingsTier;
  permission?: SettingsPermission;
  children?: SettingsRoute[];
  keywords?: string[];
  component?: string;
}

export interface SettingsSearchResult {
  route: SettingsRoute;
  score: number;
  matchedTerms: string[];
}

export interface UserPermissions {
  permissions: SettingsPermission[];
  role: string;
  organizationId?: string;
  teamId?: string;
}

export interface SettingsContextType {
  currentRoute: string;
  navigateTo: (path: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  permissions: UserPermissions;
  hasPermission: (permission: SettingsPermission) => boolean;
  breadcrumbs: Array<{ label: string; path: string }>;
}

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  actions?: React.ReactNode;
}

export interface DangerZoneAction {
  label: string;
  description: string;
  buttonText: string;
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  domain: string;
  industry?: string;
  size?: string;
  createdAt: string;
}

export interface OrganizationUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department?: string;
  status: 'active' | 'invited' | 'suspended' | 'deactivated';
  lastLoginAt?: string;
  createdAt: string;
  groups: string[];
}

export interface OrganizationRole {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isCustom: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'read' | 'write' | 'admin' | 'delete';
  category: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  parentGroupId?: string;
  createdAt: string;
}

export interface AuthPolicy {
  id: string;
  ssoEnforced: boolean;
  mfaRequired: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  maxConcurrentSessions: number;
}

export interface AllowedDomain {
  id: string;
  domain: string;
  type: 'whitelist' | 'blacklist';
  autoProvision: boolean;
  createdAt: string;
}

export interface SSOConfig {
  id: string;
  provider: 'saml' | 'oidc';
  enabled: boolean;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
  createdAt: string;
}

export interface SCIMConfig {
  id: string;
  enabled: boolean;
  endpoint: string;
  token: string;
  syncUsers: boolean;
  syncGroups: boolean;
  lastSyncAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
}

export interface BillingPlan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  price: number;
  billingCycle: 'monthly' | 'annual';
  features: string[];
  limits: {
    users: number;
    storage: number;
    apiCalls: number;
  };
}

export interface BillingUsage {
  users: number;
  storage: number;
  apiCalls: number;
  period: string;
}

export interface DataExportRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  expiresAt?: string;
}
export * from './vos';
