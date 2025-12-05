/**
 * Multi-Tenant Context for SDUI
 * 
 * Provides tenant-specific configuration and permissions for SDUI rendering.
 * All SDUI operations must be tenant-aware to ensure proper data isolation.
 */

/**
 * Theme configuration for tenant
 */
export interface ThemeConfig {
  mode: 'dark' | 'light';
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  customStyles?: Record<string, any>;
}

/**
 * Tenant context for SDUI rendering
 */
export interface TenantContext {
  /**
   * Unique tenant identifier
   */
  tenantId: string;

  /**
   * Organization identifier (multiple tenants can belong to one org)
   */
  organizationId: string;

  /**
   * Current user identifier
   */
  userId: string;

  /**
   * User permissions for this tenant
   */
  permissions: string[];

  /**
   * Theme configuration
   */
  theme: ThemeConfig;

  /**
   * Feature flags for this tenant
   */
  featureFlags: Record<string, boolean>;

  /**
   * Data residency requirement
   */
  dataResidency: 'us' | 'eu' | 'apac';

  /**
   * User locale for i18n
   */
  locale?: string;

  /**
   * Session metadata
   */
  sessionId?: string;

  /**
   * Additional custom metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Default theme configuration (dark mode with neon green)
 */
export const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  primaryColor: '#121212',
  accentColor: '#39FF14',
  fontFamily: 'Inter, sans-serif',
};

/**
 * Create a tenant context with defaults
 */
export function createTenantContext(
  partial: Partial<TenantContext> & Pick<TenantContext, 'tenantId' | 'organizationId' | 'userId'>
): TenantContext {
  return {
    permissions: [],
    theme: DEFAULT_THEME,
    featureFlags: {},
    dataResidency: 'us',
    ...partial,
  };
}

/**
 * Check if user has permission
 */
export function hasPermission(context: TenantContext, permission: string): boolean {
  return context.permissions.includes(permission) || context.permissions.includes('*');
}

/**
 * Check if feature flag is enabled
 */
export function isFeatureEnabled(context: TenantContext, feature: string): boolean {
  return context.featureFlags[feature] === true;
}

/**
 * Validate tenant context
 */
export function validateTenantContext(context: unknown): context is TenantContext {
  if (!context || typeof context !== 'object') {
    return false;
  }

  const ctx = context as any;
  return (
    typeof ctx.tenantId === 'string' &&
    typeof ctx.organizationId === 'string' &&
    typeof ctx.userId === 'string' &&
    Array.isArray(ctx.permissions) &&
    typeof ctx.theme === 'object' &&
    typeof ctx.featureFlags === 'object' &&
    ['us', 'eu', 'apac'].includes(ctx.dataResidency)
  );
}

/**
 * Tenant-aware error class
 */
export class TenantContextError extends Error {
  constructor(
    message: string,
    public readonly tenantId?: string,
    public readonly context?: Partial<TenantContext>
  ) {
    super(message);
    this.name = 'TenantContextError';
  }
}
