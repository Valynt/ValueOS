/**
 * Tenant-Aware Data Binding
 * 
 * Extends data binding system with tenant isolation and permission checks.
 * Ensures all data access is properly scoped to the tenant context.
 */

import { DataBinding, DataSourceContext, ResolvedBinding } from './DataBindingSchema';
import { TenantContext, hasPermission, TenantContextError } from './TenantContext';

/**
 * Permission requirements for data sources
 */
export const DATA_SOURCE_PERMISSIONS: Record<string, string> = {
  realization_engine: 'data:realization:read',
  system_mapper: 'data:system:read',
  intervention_designer: 'data:intervention:read',
  outcome_engineer: 'data:outcome:read',
  value_eval: 'data:evaluation:read',
  semantic_memory: 'data:memory:read',
  tool_registry: 'tools:execute',
  supabase: 'data:database:read',
  mcp_tool: 'tools:mcp:execute',
};

/**
 * Tenant-aware data binding configuration
 */
export interface TenantAwareDataBinding extends DataBinding {
  /**
   * Required permission to access this binding
   */
  $permission?: string;

  /**
   * Tenant ID override (defaults to context tenant)
   */
  $tenantId?: string;

  /**
   * Organization ID override (defaults to context org)
   */
  $organizationId?: string;

  /**
   * Whether to enforce strict tenant isolation
   */
  $strictIsolation?: boolean;
}

/**
 * Check if user has permission to access data source
 */
export function checkDataSourcePermission(
  binding: TenantAwareDataBinding,
  context: TenantContext
): boolean {
  // Check custom permission if specified
  if (binding.$permission) {
    return hasPermission(context, binding.$permission);
  }

  // Check default data source permission
  const defaultPermission = DATA_SOURCE_PERMISSIONS[binding.$source];
  if (defaultPermission) {
    return hasPermission(context, defaultPermission);
  }

  // If no permission defined, allow (for backward compatibility)
  return true;
}

/**
 * Validate tenant context for data binding
 */
export function validateTenantBinding(
  binding: TenantAwareDataBinding,
  context: TenantContext
): void {
  // Check permission
  if (!checkDataSourcePermission(binding, context)) {
    const permission = binding.$permission || DATA_SOURCE_PERMISSIONS[binding.$source];
    throw new TenantContextError(
      `Permission denied: User lacks '${permission}' permission for data source '${binding.$source}'`,
      context.tenantId,
      context
    );
  }

  // Validate tenant ID if specified
  if (binding.$tenantId && binding.$tenantId !== context.tenantId) {
    if (binding.$strictIsolation !== false) {
      throw new TenantContextError(
        `Tenant isolation violation: Binding requires tenant '${binding.$tenantId}' but context is '${context.tenantId}'`,
        context.tenantId,
        context
      );
    }
  }

  // Validate organization ID if specified
  if (binding.$organizationId && binding.$organizationId !== context.organizationId) {
    if (binding.$strictIsolation !== false) {
      throw new TenantContextError(
        `Organization isolation violation: Binding requires org '${binding.$organizationId}' but context is '${context.organizationId}'`,
        context.tenantId,
        context
      );
    }
  }
}

/**
 * Enhance data source context with tenant information
 */
export function createTenantDataSourceContext(
  tenantContext: TenantContext,
  binding?: TenantAwareDataBinding
): DataSourceContext {
  return {
    organizationId: binding?.$organizationId || tenantContext.organizationId,
    userId: tenantContext.userId,
    sessionId: tenantContext.sessionId,
    metadata: {
      tenantId: binding?.$tenantId || tenantContext.tenantId,
      permissions: tenantContext.permissions,
      dataResidency: tenantContext.dataResidency,
      ...tenantContext.metadata,
    },
  };
}

/**
 * Filter data based on tenant permissions
 */
export function filterTenantData<T = any>(
  data: T,
  context: TenantContext,
  filterRules?: TenantDataFilterRules
): T {
  if (!filterRules) return data;

  // Apply field-level filtering
  if (filterRules.fields && typeof data === 'object' && data !== null) {
    const filtered: any = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const fieldRule = filterRules.fields[key];

      // Check if field requires permission
      if (fieldRule?.permission && !hasPermission(context, fieldRule.permission)) {
        continue; // Skip field
      }

      // Apply field transformation
      if (fieldRule?.transform) {
        filtered[key] = fieldRule.transform(value, context);
      } else {
        filtered[key] = value;
      }
    }

    return filtered as T;
  }

  // Apply row-level filtering for arrays
  if (Array.isArray(data) && filterRules.rowFilter) {
    return data.filter((row) => filterRules.rowFilter!(row, context)) as T;
  }

  return data;
}

/**
 * Tenant data filter rules
 */
export interface TenantDataFilterRules {
  /**
   * Field-level filtering rules
   */
  fields?: Record<string, {
    permission?: string;
    transform?: (value: any, context: TenantContext) => any;
  }>;

  /**
   * Row-level filtering function
   */
  rowFilter?: (row: any, context: TenantContext) => boolean;
}

/**
 * Audit log entry for data access
 */
export interface DataAccessAuditLog {
  timestamp: string;
  tenantId: string;
  userId: string;
  dataSource: string;
  bindingPath: string;
  action: 'read' | 'write';
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Log data access for audit trail
 */
export function logDataAccess(
  binding: TenantAwareDataBinding,
  context: TenantContext,
  result: ResolvedBinding
): DataAccessAuditLog {
  const log: DataAccessAuditLog = {
    timestamp: new Date().toISOString(),
    tenantId: context.tenantId,
    userId: context.userId,
    dataSource: binding.$source,
    bindingPath: binding.$bind,
    action: 'read',
    success: result.success,
    error: result.error,
    metadata: {
      cached: result.cached,
      sessionId: context.sessionId,
      dataResidency: context.dataResidency,
    },
  };

  // In production, send to audit logging service
  console.log('[DATA ACCESS AUDIT]', log);

  return log;
}

/**
 * Create tenant-scoped cache key
 */
export function createTenantCacheKey(
  binding: TenantAwareDataBinding,
  context: TenantContext
): string {
  const tenantId = binding.$tenantId || context.tenantId;
  const orgId = binding.$organizationId || context.organizationId;
  const cacheKey = binding.$cache || `${binding.$source}:${binding.$bind}`;

  return `tenant:${tenantId}:org:${orgId}:${cacheKey}`;
}

/**
 * Tenant-aware data binding helper
 */
export function createTenantBinding(
  path: string,
  source: string,
  tenantContext: TenantContext,
  options?: Partial<Omit<TenantAwareDataBinding, '$bind' | '$source'>>
): TenantAwareDataBinding {
  return {
    $bind: path,
    $source: source as any,
    $tenantId: tenantContext.tenantId,
    $organizationId: tenantContext.organizationId,
    $strictIsolation: true,
    ...options,
  };
}

/**
 * Validate data residency compliance
 */
export function validateDataResidency(
  binding: TenantAwareDataBinding,
  context: TenantContext
): void {
  // Check if data source respects data residency requirements
  const residencyCompliantSources = ['supabase', 'semantic_memory'];

  if (!residencyCompliantSources.includes(binding.$source)) {
    console.warn(
      `[DATA RESIDENCY] Data source '${binding.$source}' may not respect data residency requirement: ${context.dataResidency}`
    );
  }

  // Add custom residency validation logic here
  // For example, check if Supabase region matches data residency
}

/**
 * Example: Create tenant-aware metric binding
 */
export function createTenantMetricBinding(
  metricPath: string,
  tenantContext: TenantContext,
  options?: Partial<Omit<TenantAwareDataBinding, '$bind' | '$source'>>
): TenantAwareDataBinding {
  return createTenantBinding(metricPath, 'realization_engine', tenantContext, {
    $transform: 'number',
    $refresh: 30000,
    $permission: 'data:realization:read',
    ...options,
  });
}

/**
 * Example: Create tenant-aware entity binding
 */
export function createTenantEntityBinding(
  entityPath: string,
  tenantContext: TenantContext,
  options?: Partial<Omit<TenantAwareDataBinding, '$bind' | '$source'>>
): TenantAwareDataBinding {
  return createTenantBinding(entityPath, 'system_mapper', tenantContext, {
    $permission: 'data:system:read',
    ...options,
  });
}

export default {
  checkDataSourcePermission,
  validateTenantBinding,
  createTenantDataSourceContext,
  filterTenantData,
  logDataAccess,
  createTenantCacheKey,
  createTenantBinding,
  validateDataResidency,
  createTenantMetricBinding,
  createTenantEntityBinding,
};
