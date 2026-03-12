import { USER_ROLE_PERMISSIONS } from "@shared/lib/permissions";

import { publishRbacInvalidation } from "../../lib/rbacInvalidation.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";

import { auditLogService } from "../security/AuditLogService.js";
import { ValidationError } from "../errors.js";

const CUSTOM_ROLE_PREFIX = "custom:";

// Role hierarchy — higher index = more privilege.
// An actor may only grant permissions they themselves hold.
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export interface AdminActor {
  id: string;
  email: string;
  name: string;
}

export interface CustomRoleInput {
  tenantId: string;
  name: string;
  description?: string;
  permissionKeys?: string[];
}

function encodeRoleName(tenantId: string, roleName: string): string {
  return `${CUSTOM_ROLE_PREFIX}${tenantId}:${roleName.trim().toLowerCase()}`;
}

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * Decode a stored role name back to the human-readable role name.
 *
 * Stored format: "custom:{tenantId}:{roleName}"
 *
 * Previous implementation used `split(':', 3)[1]` which returned the tenantId
 * segment (index 1), not the role name (index 2). Fixed by stripping the
 * "custom:" prefix and then the tenantId segment explicitly.
 *
 * When tenantId is provided it is stripped precisely, preserving any colons
 * that may appear in the role name itself.
 */
function decodeRoleName(rawName: string, tenantId?: string): string {
  if (!rawName.startsWith(CUSTOM_ROLE_PREFIX)) return rawName;
  const withoutPrefix = rawName.slice(CUSTOM_ROLE_PREFIX.length); // "{tenantId}:{roleName}"
  if (tenantId && withoutPrefix.startsWith(`${tenantId}:`)) {
    return withoutPrefix.slice(tenantId.length + 1);
  }
  // Fallback: strip up to and including the first colon (tenantId segment).
  const colonIdx = withoutPrefix.indexOf(":");
  return colonIdx === -1 ? withoutPrefix : withoutPrefix.slice(colonIdx + 1);
}

export class AdminRoleService {
  private supabase = createServerSupabaseClient();

  /**
   * Fetch the actor's system role in the given tenant and expand it to the
   * full permission set they hold. Used to enforce the privilege ceiling —
   * an actor cannot grant permissions they do not themselves possess.
   */
  private async getActorPermissions(actorId: string, tenantId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", actorId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) return new Set();

    const rolePerms = USER_ROLE_PERMISSIONS[data.role as keyof typeof USER_ROLE_PERMISSIONS] ?? [];
    return new Set(rolePerms as string[]);
  }

  /**
   * Assert that every requested permission key is held by the actor.
   * Owners bypass the check — they hold all permissions by definition.
   */
  private async assertPrivilegeCeiling(
    actor: AdminActor,
    tenantId: string,
    permissionKeys: string[],
  ): Promise<void> {
    if (!permissionKeys.length) return;

    // Fetch actor's current role rank first — owners skip the per-permission check.
    const { data: actorRow } = await this.supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", actor.id)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    const actorRank = ROLE_RANK[actorRow?.role ?? ""] ?? -1;
    if (actorRank >= ROLE_RANK["owner"]) return; // owners may grant anything

    const actorPerms = await this.getActorPermissions(actor.id, tenantId);
    const forbidden = permissionKeys.filter((key) => !actorPerms.has(key));

    if (forbidden.length > 0) {
      throw new ValidationError(
        `Cannot grant permissions exceeding your own privilege: ${forbidden.join(", ")}`,
      );
    }
  }

  private async resolvePermissionIds(permissionKeys: string[]): Promise<string[]> {
    if (!permissionKeys.length) return [];

    const { data, error } = await this.supabase
      .from("permissions")
      .select("id,key")
      .in("key", permissionKeys);

    if (error) {
      throw new ValidationError(`Failed to resolve permissions: ${error.message}`);
    }

    const found = new Map((data || []).map((p: any) => [p.key, p.id]));
    const missing = permissionKeys.filter((key) => !found.has(key));
    if (missing.length > 0) {
      throw new ValidationError(`Unknown permissions: ${missing.join(", ")}`);
    }

    return permissionKeys.map((key) => found.get(key) as string);
  }

  async createCustomRole(actor: AdminActor, input: CustomRoleInput) {
    const encodedName = encodeRoleName(input.tenantId, input.name);

    const { data: existing, error: existingError } = await this.supabase
      .from("roles")
      .select("id")
      .eq("name", encodedName)
      .maybeSingle();

    if (existingError) {
      throw new ValidationError(`Failed to validate role uniqueness: ${existingError.message}`);
    }

    if (existing) {
      throw new ValidationError("Role already exists for tenant");
    }

    const { data: role, error } = await this.supabase
      .from("roles")
      .insert({
        name: encodedName,
        description: input.description || null,
        permissions: [],
        tenant_id: input.tenantId,
        slug: toSlug(input.name),
        is_system_role: false,
      })
      .select("id,name,description,created_at")
      .single();

    if (error) {
      throw new ValidationError(`Failed to create role: ${error.message}`);
    }

    if (input.permissionKeys && input.permissionKeys.length > 0) {
      await this.assignPermissionsToRole(actor, {
        tenantId: input.tenantId,
        roleId: role.id,
        permissionKeys: input.permissionKeys,
      });
    }

    await auditLogService.logAudit({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: "rbac.role.create",
      resourceType: "role",
      resourceId: role.id,
      details: {
        tenantId: input.tenantId,
        roleName: input.name,
        description: input.description,
        permissionKeys: input.permissionKeys || [],
      },
    });

    await publishRbacInvalidation({ roleId: role.id, tenantId: input.tenantId });

    return {
      id: role.id,
      name: decodeRoleName(role.name, input.tenantId),
      description: role.description,
      createdAt: role.created_at,
    };
  }

  async updateCustomRole(actor: AdminActor, roleId: string, input: CustomRoleInput) {
    // Fetch current state before mutating for the audit before_state.
    const { data: current } = await this.supabase
      .from("roles")
      .select("name,description")
      .eq("id", roleId)
      .maybeSingle();
    const previousName = current ? decodeRoleName(current.name, input.tenantId) : null;
    const previousDescription = current?.description ?? null;

    const encodedName = encodeRoleName(input.tenantId, input.name);
    const { data, error } = await this.supabase
      .from("roles")
      .update({ name: encodedName, description: input.description || null })
      .eq("id", roleId)
      .select("id,name,description,created_at")
      .single();

    if (error) {
      throw new ValidationError(`Failed to update role: ${error.message}`);
    }

    await auditLogService.logAudit({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: "rbac.role.update",
      resourceType: "role",
      resourceId: roleId,
      details: { tenantId: input.tenantId },
      beforeState: { name: previousName, description: previousDescription },
      afterState: { name: input.name, description: input.description ?? null },
    });

    await publishRbacInvalidation({ roleId, tenantId: input.tenantId });

    return {
      id: data.id,
      name: decodeRoleName(data.name, input.tenantId),
      description: data.description,
      createdAt: data.created_at,
    };
  }

  async deleteCustomRole(actor: AdminActor, tenantId: string, roleId: string) {
    const { error: rpError } = await this.supabase.from("role_permissions").delete().eq("role_id", roleId);
    if (rpError) {
      throw new ValidationError(`Failed to clear role permissions: ${rpError.message}`);
    }

    const { error: mrError } = await this.supabase.from("membership_roles").delete().eq("role_id", roleId);
    if (mrError) {
      throw new ValidationError(`Failed to clear role memberships: ${mrError.message}`);
    }

    const { error } = await this.supabase.from("roles").delete().eq("id", roleId);
    if (error) {
      throw new ValidationError(`Failed to delete role: ${error.message}`);
    }

    await auditLogService.logAudit({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: "rbac.role.delete",
      resourceType: "role",
      resourceId: roleId,
      details: { tenantId },
    });

    // Invalidate all caches — deleted role may have been held by any user in the tenant.
    await publishRbacInvalidation({ roleId, tenantId });
  }

  async assignPermissionsToRole(
    actor: AdminActor,
    input: { tenantId: string; roleId: string; permissionKeys: string[] }
  ) {
    // Enforce privilege ceiling — actor cannot grant permissions they don't hold.
    await this.assertPrivilegeCeiling(actor, input.tenantId, input.permissionKeys);

    const permissionIds = await this.resolvePermissionIds(input.permissionKeys);

    const rows = permissionIds.map((permissionId) => ({
      role_id: input.roleId,
      permission_id: permissionId,
    }));

    if (rows.length > 0) {
      const { error } = await this.supabase
        .from("role_permissions")
        .upsert(rows, { onConflict: "role_id,permission_id" });

      if (error) {
        throw new ValidationError(`Failed to assign permissions: ${error.message}`);
      }
    }

    await auditLogService.logAudit({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: "rbac.role_permissions.assign",
      resourceType: "role",
      resourceId: input.roleId,
      details: {
        tenantId: input.tenantId,
        permissionKeys: input.permissionKeys,
      },
    });

    await publishRbacInvalidation({ roleId: input.roleId, tenantId: input.tenantId });
  }

  async removePermissionsFromRole(
    actor: AdminActor,
    input: { tenantId: string; roleId: string; permissionKeys: string[] }
  ) {
    const permissionIds = await this.resolvePermissionIds(input.permissionKeys);

    if (permissionIds.length > 0) {
      const { error } = await this.supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", input.roleId)
        .in("permission_id", permissionIds);

      if (error) {
        throw new ValidationError(`Failed to remove permissions: ${error.message}`);
      }
    }

    await auditLogService.logAudit({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: "rbac.role_permissions.remove",
      resourceType: "role",
      resourceId: input.roleId,
      details: {
        tenantId: input.tenantId,
        permissionKeys: input.permissionKeys,
      },
    });

    await publishRbacInvalidation({ roleId: input.roleId, tenantId: input.tenantId });
  }

  async listRolePermissionMatrix(tenantId: string) {
    const { data: tenantMemberships, error: membershipError } = await this.supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId);

    if (membershipError) {
      throw new ValidationError(`Failed to fetch tenant memberships: ${membershipError.message}`);
    }

    const membershipIds = (tenantMemberships || []).map((m: any) => m.id);
    if (membershipIds.length === 0) {
      return [];
    }

    const { data: membershipRoles, error: membershipRolesError } = await this.supabase
      .from("membership_roles")
      .select("role_id")
      .in("membership_id", membershipIds);

    if (membershipRolesError) {
      throw new ValidationError(`Failed to fetch membership roles: ${membershipRolesError.message}`);
    }

    const roleIds = Array.from(new Set((membershipRoles || []).map((mr: any) => mr.role_id)));
    if (roleIds.length === 0) {
      return [];
    }

    const [{ data: roles, error: rolesError }, { data: rolePermissions, error: rpError }] = await Promise.all([
      this.supabase.from("roles").select("id,name,description").in("id", roleIds),
      this.supabase
        .from("role_permissions")
        .select("role_id, permissions(key, description)")
        .in("role_id", roleIds),
    ]);

    if (rolesError) {
      throw new ValidationError(`Failed to load roles: ${rolesError.message}`);
    }

    if (rpError) {
      throw new ValidationError(`Failed to load role permissions: ${rpError.message}`);
    }

    const permissionsByRole = new Map<string, { key: string; description?: string }[]>();

    for (const row of rolePermissions || []) {
      const current = permissionsByRole.get(row.role_id) || [];
      const permission = Array.isArray((row as any).permissions)
        ? (row as any).permissions[0]
        : (row as any).permissions;

      if (permission?.key) {
        current.push({ key: permission.key, description: permission.description || undefined });
        permissionsByRole.set(row.role_id, current);
      }
    }

    return (roles || [])
      .filter((role: any) => role.tenant_id === tenantId || role.name.startsWith(`${CUSTOM_ROLE_PREFIX}${tenantId}:`))
      .map((role: any) => ({
        id: role.id,
        name: decodeRoleName(role.name, tenantId),
        description: role.description,
        permissions: permissionsByRole.get(role.id) || [],
      }));
  }
}

export const adminRoleService = new AdminRoleService();
