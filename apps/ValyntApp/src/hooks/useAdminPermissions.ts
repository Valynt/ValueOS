/**
 * Admin Permissions Hook
 *
 * Maps the current user's TenantRole to fine-grained AdminPermission set.
 * Used by AdminLayout and navigation to gate section visibility.
 *
 * See: docs/architecture/admin-settings-ia.md (Role Model Gap section)
 */

import { useMemo } from 'react';

import type { AdminPermission } from '../lib/adminNavigation';

type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Permission sets per role.
 *
 * This is the bridge between the coarse TenantRole system and the
 * fine-grained AdminPermission model required by the IA.
 *
 * When dedicated admin roles (Security Admin, Billing Admin, etc.)
 * are implemented, this mapping should be replaced with a
 * database-driven permission set per user.
 */
export const ROLE_PERMISSIONS: Record<TenantRole, AdminPermission[]> = {
  owner: [
    'governance.read', 'governance.write',
    'identity.read', 'identity.write',
    'security.read', 'security.write',
    'agents.read', 'agents.write',
    'data.read', 'data.write',
    'compliance.read', 'compliance.write',
    'billing.read', 'billing.write',
  ],
  admin: [
    'governance.read', 'governance.write',
    'identity.read', 'identity.write',
    'security.read',
    'agents.read', 'agents.write',
    'data.read', 'data.write',
    'compliance.read',
    'billing.read',
  ],
  member: [
    'governance.read',
    'identity.read',
    'agents.read',
    'billing.read',
  ],
  viewer: [
    'governance.read',
    'billing.read',
  ],
};

/**
 * Platform super admin gets all permissions including platform scope.
 */
const PLATFORM_ADMIN_PERMISSIONS: AdminPermission[] = [
  ...ROLE_PERMISSIONS.owner,
  'platform.read', 'platform.write',
];

interface UseAdminPermissionsResult {
  permissions: Set<AdminPermission>;
  hasPermission: (permission: AdminPermission) => boolean;
  canWrite: (section: string) => boolean;
  isPlatformAdmin: boolean;
}

export function resolveTenantRole(roles: string[] | undefined): TenantRole {
  if (!roles || roles.length === 0) return 'viewer';

  const normalizedRoles = roles.map((role) => role.toLowerCase());
  if (normalizedRoles.includes('owner')) return 'owner';
  if (normalizedRoles.includes('admin')) return 'admin';
  if (normalizedRoles.includes('member')) return 'member';
  return 'viewer';
}

/**
 * Returns the admin permission set for the current user.
 *
 * @param role - The user's TenantRole
 * @param isPlatformAdmin - Whether the user is a platform super admin
 */
export function useAdminPermissions(
  role: TenantRole = 'viewer',
  isPlatformAdmin = false
): UseAdminPermissionsResult {
  const permissions = useMemo(() => {
    const perms = isPlatformAdmin
      ? PLATFORM_ADMIN_PERMISSIONS
      : (ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer);
    return new Set(perms);
  }, [role, isPlatformAdmin]);

  const hasPermission = useMemo(
    () => (permission: AdminPermission) => permissions.has(permission),
    [permissions]
  );

  const canWrite = useMemo(
    () => (section: string) => permissions.has(`${section}.write` as AdminPermission),
    [permissions]
  );

  return {
    permissions,
    hasPermission,
    canWrite,
    isPlatformAdmin,
  };
}
