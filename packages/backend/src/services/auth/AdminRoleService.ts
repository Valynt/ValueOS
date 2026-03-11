import { createServerSupabaseClient } from "../lib/supabase.js";

import { auditLogService } from "./AuditLogService.js";
import { ValidationError } from "./errors.js";

const CUSTOM_ROLE_PREFIX = "custom:";

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

function decodeRoleName(rawName: string): string {
  const [, roleName] = rawName.split(":", 3);
  return roleName || rawName;
}

export class AdminRoleService {
  private supabase = createServerSupabaseClient();

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
      .insert({ name: encodedName, description: input.description || null, permissions: [] })
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

    return {
      id: role.id,
      name: decodeRoleName(role.name),
      description: role.description,
      createdAt: role.created_at,
    };
  }

  async updateCustomRole(actor: AdminActor, roleId: string, input: CustomRoleInput) {
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
      details: {
        tenantId: input.tenantId,
        roleName: input.name,
        description: input.description,
      },
    });

    return {
      id: data.id,
      name: decodeRoleName(data.name),
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
  }

  async assignPermissionsToRole(
    actor: AdminActor,
    input: { tenantId: string; roleId: string; permissionKeys: string[] }
  ) {
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
      .filter((role: any) => role.name.startsWith(`${CUSTOM_ROLE_PREFIX}${tenantId}:`))
      .map((role: any) => ({
        id: role.id,
        name: decodeRoleName(role.name),
        description: role.description,
        permissions: permissionsByRole.get(role.id) || [],
      }));
  }
}

export const adminRoleService = new AdminRoleService();
