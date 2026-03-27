import { logger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';

import { settingsService } from './SettingsService.js';

import { TIER_FEATURES, TIER_LIMITS } from './TenantLimits.js';
import type { TenantConfig } from './TenantProvisioningTypes.js';

export async function createOrganization(config: TenantConfig): Promise<string> {
  const supabase = createServerSupabaseClient();

  let dbTier = config.tier;
  if (config.tier === 'starter') {
    dbTier = 'professional' as unknown as typeof config.tier;
  }

  const limits = config.limits || TIER_LIMITS[config.tier];
  const features = config.features || TIER_FEATURES[config.tier];

  const { data: provisionedTenantId, error } = await supabase.rpc('provision_tenant', {
    organization_name: config.name,
    user_id: config.ownerId,
  });

  if (error) {
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  if (!provisionedTenantId || typeof provisionedTenantId !== 'string') {
    throw new Error('Failed to create organization: provision_tenant returned invalid tenant id');
  }

  const { error: settingsError } = await supabase.from('organizations').update({
    tier: dbTier,
    settings: {
      ...config.settings,
      tier: config.tier,
      limits,
      features,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', provisionedTenantId);

  if (settingsError) {
    throw new Error(`Failed to update organization defaults: ${settingsError.message}`);
  }

  logger.debug(`Organization ${provisionedTenantId} created and owner assigned`);

  return provisionedTenantId;
}

export async function initializeSettings(config: TenantConfig): Promise<void> {
  const defaultSettings = {
    ...config.settings,
    tier: config.tier,
    limits: config.limits || TIER_LIMITS[config.tier],
    features: config.features || TIER_FEATURES[config.tier],
  };

  await settingsService.initializeOrganizationSettings(
    config.organizationId,
    defaultSettings,
    config.ownerId
  );

  logger.debug(`Settings initialized for ${config.organizationId}`);
}

export async function createTeamsAndRoles(config: TenantConfig): Promise<void> {
  const supabase = createServerSupabaseClient();
  const tenantId = config.organizationId;

  const { error: teamError } = await supabase.from('teams').upsert({
    tenant_id: tenantId,
    name: 'Default Team',
    description: 'Default team for all members',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    team_settings: {}
  }, { onConflict: 'tenant_id,name' }).select().single();

  if (teamError) {
    throw new Error(`Failed to create default team: ${teamError.message}`);
  }

  logger.debug(`Default team created for ${tenantId}`);

  const defaultRoles = ['owner', 'admin', 'member', 'viewer'];
  const { data: existingRoles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name')
    .in('name', defaultRoles);

  if (rolesError) {
    throw new Error(`Failed to check roles: ${rolesError.message}`);
  }

  const existingRolesMap = new Map((existingRoles || []).map((r) => [r.name, r.id]));
  let ownerRoleId: string | undefined;

  for (const roleName of defaultRoles) {
    let roleId = existingRolesMap.get(roleName);

    if (!roleId) {
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          name: roleName,
          description: `System role: ${roleName}`,
          permissions: getDefaultPermissions(roleName),
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create role ${roleName}: ${createError.message}`);
      }
      roleId = newRole.id;
      logger.debug(`Created missing global role: ${roleName}`);
    }

    if (roleName === 'owner') {
      ownerRoleId = roleId;
    }
  }

  if (ownerRoleId) {
    const { data: existingUserRole, error: userRoleCheckError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', config.ownerId)
      .eq('tenant_id', tenantId)
      .eq('role_id', ownerRoleId)
      .single();

    if (userRoleCheckError && userRoleCheckError.code !== 'PGRST116') {
      throw new Error(`Failed to check user role assignment: ${userRoleCheckError.message}`);
    }

    if (!existingUserRole) {
      const { error: assignError } = await supabase.from('user_roles').insert({
        user_id: config.ownerId,
        tenant_id: tenantId,
        role_id: ownerRoleId,
        created_at: new Date().toISOString(),
      });

      if (assignError) {
        throw new Error(`Failed to assign owner role: ${assignError.message}`);
      }
      logger.debug(`Assigned owner role to ${config.ownerId} for tenant ${tenantId}`);
    }
  }

  logger.debug(`Teams and roles setup complete for ${config.organizationId}`);
}

function getDefaultPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    owner: ['*'],
    admin: [
      'read:*',
      'write:*',
      'delete:*',
      'manage:users',
      'manage:teams',
      'manage:settings',
    ],
    member: [
      'read:*',
      'write:own',
      'delete:own',
    ],
    viewer: [
      'read:*',
    ],
  };

  return permissions[role] || [];
}
