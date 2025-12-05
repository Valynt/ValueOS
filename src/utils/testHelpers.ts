/**
 * Testing Utilities for Permission Testing and Integration Tests
 */

import { logger } from '../lib/logger';
import { Permission } from '../services/PermissionService';

export type RoleType = 'admin' | 'moderator' | 'member' | 'guest' | 'owner';

export interface RolePermissions {
  role: RoleType;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: Record<RoleType, Permission[]> = {
  admin: [
    'user.view',
    'user.edit',
    'team.view',
    'team.manage',
    'organization.manage',
    'members.manage',
    'billing.view',
    'billing.manage',
    'security.manage',
    'audit.view',
  ],
  moderator: [
    'user.view',
    'user.edit',
    'team.view',
    'team.manage',
    'members.manage',
    'audit.view',
  ],
  member: ['user.view', 'user.edit', 'team.view'],
  guest: ['user.view', 'team.view'],
  owner: [
    'user.view',
    'user.edit',
    'team.view',
    'team.manage',
    'organization.manage',
    'members.manage',
    'billing.view',
    'billing.manage',
    'security.manage',
    'audit.view',
  ],
};

/**
 * Generate all possible role combinations for testing
 */
export function generateRoleCombinations(): RoleType[][] {
  const roles: RoleType[] = ['admin', 'moderator', 'member', 'guest', 'owner'];
  const combinations: RoleType[][] = [];

  // Single roles
  roles.forEach((role) => {
    combinations.push([role]);
  });

  // Pairs
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      combinations.push([roles[i], roles[j]]);
    }
  }

  // Triples (sample)
  combinations.push(['admin', 'moderator', 'member']);
  combinations.push(['admin', 'member', 'guest']);

  return combinations;
}

/**
 * Get effective permissions for role combination
 */
export function getEffectivePermissions(roles: RoleType[]): Permission[] {
  const permissionSet = new Set<Permission>();

  roles.forEach((role) => {
    const rolePermissions = ROLE_DEFINITIONS[role];
    rolePermissions.forEach((p) => permissionSet.add(p));
  });

  return Array.from(permissionSet);
}

/**
 * Check if roles have permission
 */
export function hasPermission(roles: RoleType[], permission: Permission): boolean {
  const effectivePermissions = getEffectivePermissions(roles);
  return effectivePermissions.includes(permission);
}

/**
 * Detect role conflicts
 */
export function detectRoleConflicts(roles: RoleType[]): {
  hasConflict: boolean;
  conflicts: Array<{ role1: RoleType; role2: RoleType; reason: string }>;
} {
  const conflicts: Array<{ role1: RoleType; role2: RoleType; reason: string }> = [];

  // Check for guest + any privileged role
  if (roles.includes('guest')) {
    ['admin', 'moderator', 'owner'].forEach((privilegedRole) => {
      if (roles.includes(privilegedRole as RoleType)) {
        conflicts.push({
          role1: 'guest',
          role2: privilegedRole as RoleType,
          reason: 'Guest role conflicts with privileged roles',
        });
      }
    });
  }

  // Check for owner + admin (redundant)
  if (roles.includes('owner') && roles.includes('admin')) {
    conflicts.push({
      role1: 'owner',
      role2: 'admin',
      reason: 'Owner and Admin roles provide identical permissions',
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Mock user with roles for testing
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  roles: RoleType[];
  organizationId: string;
  teamId?: string;
}

export function createMockUser(
  overrides: Partial<MockUser> = {}
): MockUser {
  return {
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    email: 'test@example.com',
    name: 'Test User',
    roles: ['member'],
    organizationId: 'test-org',
    ...overrides,
  };
}

/**
 * Permission test cases generator
 */
export function generatePermissionTestCases(): Array<{
  roles: RoleType[];
  permission: Permission;
  expected: boolean;
  description: string;
}> {
  const testCases: Array<{
    roles: RoleType[];
    permission: Permission;
    expected: boolean;
    description: string;
  }> = [];

  // Test each role individually
  Object.entries(ROLE_DEFINITIONS).forEach(([role, permissions]) => {
    permissions.forEach((permission) => {
      testCases.push({
        roles: [role as RoleType],
        permission,
        expected: true,
        description: `${role} should have ${permission}`,
      });
    });

    // Test permissions they shouldn't have
    const allPermissions: Permission[] = [
      'user.view',
      'user.edit',
      'team.view',
      'team.manage',
      'organization.manage',
      'members.manage',
      'billing.view',
      'billing.manage',
      'security.manage',
      'audit.view',
    ];

    allPermissions.forEach((permission) => {
      if (!permissions.includes(permission)) {
        testCases.push({
          roles: [role as RoleType],
          permission,
          expected: false,
          description: `${role} should NOT have ${permission}`,
        });
      }
    });
  });

  // Test role combinations
  testCases.push({
    roles: ['member', 'moderator'],
    permission: 'team.manage',
    expected: true,
    description: 'Member + Moderator should have team.manage (from moderator)',
  });

  testCases.push({
    roles: ['guest', 'member'],
    permission: 'user.edit',
    expected: true,
    description: 'Guest + Member should have user.edit (from member)',
  });

  return testCases;
}

/**
 * Simulate API delay for testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performance test helper
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  logger.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * Generate test data for pagination
 */
export function generateTestData<T>(
  count: number,
  factory: (index: number) => T
): T[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}

/**
 * Mock API response
 */
export function mockApiResponse<T>(
  data: T,
  options: { delay?: number; shouldFail?: boolean; errorMessage?: string } = {}
): Promise<T> {
  const { delay: ms = 100, shouldFail = false, errorMessage = 'Mock API error' } = options;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error(errorMessage));
      } else {
        resolve(data);
      }
    }, ms);
  });
}

/**
 * Test permission inheritance
 */
export function testPermissionInheritance(
  parentRoles: RoleType[],
  childRoles: RoleType[]
): {
  inherited: Permission[];
  unique: Permission[];
  conflicts: Permission[];
} {
  const parentPermissions = getEffectivePermissions(parentRoles);
  const childPermissions = getEffectivePermissions(childRoles);

  const inherited = parentPermissions.filter((p) => childPermissions.includes(p));
  const unique = childPermissions.filter((p) => !parentPermissions.includes(p));

  // Check for conflicts (permissions that should not be inherited)
  const conflicts: Permission[] = [];
  if (childRoles.includes('guest') && parentRoles.includes('admin')) {
    conflicts.push(...(ROLE_DEFINITIONS.admin.filter(
      (p) => !ROLE_DEFINITIONS.guest.includes(p)
    ) as Permission[]));
  }

  return { inherited, unique, conflicts };
}
