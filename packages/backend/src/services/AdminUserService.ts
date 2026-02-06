/**
 * Admin User Service
 *
 * Handles tenant user administration with server-side permissions and audit logging.
 */

import { createServerSupabaseClient } from "../lib/supabase.js"
import { logger } from "../lib/logger.js"
import { AuditLogService } from "./AuditLogService.js"
import { authDirectoryService } from "./AuthDirectoryService.js"
import { ValidationError } from "./errors.js"

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export interface AdminActor {
  id: string;
  email: string;
  name: string;
}

export interface InviteUserPayload {
  email: string;
  role: TenantRole;
  tenantId: string;
}

export interface UpdateRolePayload {
  userId: string;
  role: TenantRole;
  tenantId: string;
}

export interface RemoveUserPayload {
  userId: string;
  tenantId: string;
}

export interface TenantUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: "active" | "invited" | "suspended" | "deactivated";
  lastLoginAt?: string;
  createdAt: string;
  groups: string[];
}

const ROLE_LABELS: Record<TenantRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "User",
  viewer: "Viewer",
};

const ROLE_METADATA_MAP: Record<TenantRole, string> = {
  owner: "ADMIN",
  admin: "ADMIN",
  member: "ANALYST",
  viewer: "ANALYST",
};

export class AdminUserService {
  private supabase: ReturnType<typeof createServerSupabaseClient> | null = null;
  private auditLogService = new AuditLogService();

  constructor() {
    if (typeof window === "undefined") {
      try {
        this.supabase = createServerSupabaseClient();
      } catch (error) {
        logger.error("Failed to initialize admin Supabase client", error as Error);
      }
    }
  }

  private getSupabase() {
    if (!this.supabase) {
      throw new ValidationError("Admin operations require server-side Supabase credentials.");
    }
    return this.supabase;
  }

  private normalizeRole(role: string): TenantRole {
    const normalized = role.toLowerCase() as TenantRole;
    if (!["owner", "admin", "member", "viewer"].includes(normalized)) {
      throw new ValidationError(`Unsupported role: ${role}`);
    }
    return normalized;
  }

  private formatRoleLabel(role: string): string {
    const normalized = this.normalizeRole(role);
    return ROLE_LABELS[normalized];
  }

  private async updateUserMetadata(userId: string, role: TenantRole, tenantId: string) {
    const { data, error } = await this.getSupabase().auth.admin.getUserById(userId);
    if (error) {
      logger.warn("Failed to fetch user metadata for update", error);
      return;
    }

    const existingMetadata = data.user?.user_metadata || {};
    const metadataRole = ROLE_METADATA_MAP[role];

    const { error: updateError } = await this.getSupabase().auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        roles: [metadataRole],
        role,
        org_id: existingMetadata.org_id || tenantId,
      },
    });

    if (updateError) {
      logger.warn("Failed to update user metadata", updateError, { userId });
    }
  }

  async listTenantUsers(tenantId: string): Promise<TenantUserRecord[]> {
    const { data, error } = await this.getSupabase()
      .from("user_tenants")
      .select("user_id, role, status, created_at")
      .eq("tenant_id", tenantId);

    if (error) {
      throw new ValidationError(`Failed to load tenant users: ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return [];
    }

    const userIds = rows.map((r) => r.user_id);

    // Guard rail: use AuthDirectoryService (auth admin APIs), never auth schema table queries.
    const authProfiles = await authDirectoryService.getProfilesByIds(userIds);

    const { data: roleRows, error: roleError } = await this.getSupabase()
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    if (roleError) {
      logger.warn("Failed to load user role enrichment", roleError, { tenantId });
    }

    const roleMap = new Map<string, string>();
    for (const roleRow of roleRows ?? []) {
      roleMap.set(roleRow.user_id, roleRow.role);
    }

    const userRecords = rows.map((row) => {
      const user = authProfiles.get(row.user_id);
      const resolvedRole = roleMap.get(row.user_id) || row.role || "member";

      return {
        id: row.user_id,
        email: user?.email || "",
        fullName: user?.fullName || "User",
        role: this.formatRoleLabel(resolvedRole),
        status: (row.status || "active") as TenantUserRecord["status"],
        lastLoginAt: user?.lastLoginAt || undefined,
        createdAt: row.created_at || user?.createdAt || new Date().toISOString(),
        groups: [],
      };
    });

    return userRecords;
  }

  async inviteUserToTenant(
    actor: AdminActor,
    payload: InviteUserPayload
  ): Promise<TenantUserRecord> {
    const role = this.normalizeRole(payload.role);
    const { data: existingUser, error: existingError } =
      await this.getSupabase().auth.admin.getUserByEmail(payload.email);

    if (existingError && existingError.message) {
      logger.warn("Failed to lookup user by email", existingError);
    }

    let user = existingUser?.user;
    let invited = false;

    if (!user) {
      const { data, error } = await this.getSupabase().auth.admin.inviteUserByEmail(payload.email, {
        data: {
          roles: [ROLE_METADATA_MAP[role]],
          role,
          org_id: payload.tenantId,
        },
      });

      if (error || !data?.user) {
        throw new ValidationError(`Failed to invite user: ${error?.message}`);
      }

      user = data.user;
      invited = true;
    }

    const { error: membershipError } = await this.getSupabase()
      .from("user_tenants")
      .upsert({
        user_id: user.id,
        tenant_id: payload.tenantId,
        role,
        status: invited ? "invited" : "active",
        updated_at: new Date().toISOString(),
      });

    if (membershipError) {
      throw new ValidationError(`Failed to update tenant membership: ${membershipError.message}`);
    }

    const { error: deleteRoleError } = await this.getSupabase()
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("tenant_id", payload.tenantId);

    if (deleteRoleError) {
      throw new ValidationError(`Failed to clear existing roles: ${deleteRoleError.message}`);
    }

    const { error: insertRoleError } = await this.getSupabase().from("user_roles").insert({
      user_id: user.id,
      tenant_id: payload.tenantId,
      role,
    });

    if (insertRoleError) {
      throw new ValidationError(`Failed to assign role: ${insertRoleError.message}`);
    }

    await this.updateUserMetadata(user.id, role, payload.tenantId);

    await this.auditLogService.logAudit({
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      action: "admin.user.invite",
      resourceType: "user",
      resourceId: user.id,
      details: {
        tenantId: payload.tenantId,
        invitedEmail: payload.email,
        role,
      },
      status: "success",
    });

    return {
      id: user.id,
      email: user.email || payload.email,
      fullName:
        (user.user_metadata?.full_name as string | undefined) || payload.email.split("@")[0],
      role: this.formatRoleLabel(role),
      status: invited ? "invited" : "active",
      lastLoginAt: user.last_sign_in_at || undefined,
      createdAt: user.created_at || new Date().toISOString(),
      groups: [],
    };
  }

  async updateUserRole(actor: AdminActor, payload: UpdateRolePayload): Promise<void> {
    const role = this.normalizeRole(payload.role);

    const { error: updateMembershipError } = await this.getSupabase()
      .from("user_tenants")
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payload.userId)
      .eq("tenant_id", payload.tenantId);

    if (updateMembershipError) {
      throw new ValidationError(`Failed to update tenant role: ${updateMembershipError.message}`);
    }

    const { error: deleteRoleError } = await this.getSupabase()
      .from("user_roles")
      .delete()
      .eq("user_id", payload.userId)
      .eq("tenant_id", payload.tenantId);

    if (deleteRoleError) {
      throw new ValidationError(`Failed to clear existing roles: ${deleteRoleError.message}`);
    }

    const { error: insertRoleError } = await this.getSupabase().from("user_roles").insert({
      user_id: payload.userId,
      tenant_id: payload.tenantId,
      role,
    });

    if (insertRoleError) {
      throw new ValidationError(`Failed to assign role: ${insertRoleError.message}`);
    }

    await this.updateUserMetadata(payload.userId, role, payload.tenantId);

    await this.auditLogService.logAudit({
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      action: "admin.user.role_change",
      resourceType: "user",
      resourceId: payload.userId,
      details: {
        tenantId: payload.tenantId,
        role,
      },
      status: "success",
    });
  }

  async removeUserFromTenant(actor: AdminActor, payload: RemoveUserPayload): Promise<void> {
    const { error: removeError } = await this.getSupabase()
      .from("user_tenants")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payload.userId)
      .eq("tenant_id", payload.tenantId);

    if (removeError) {
      throw new ValidationError(`Failed to update membership: ${removeError.message}`);
    }

    const { error: deleteRoleError } = await this.getSupabase()
      .from("user_roles")
      .delete()
      .eq("user_id", payload.userId)
      .eq("tenant_id", payload.tenantId);

    if (deleteRoleError) {
      throw new ValidationError(`Failed to remove role: ${deleteRoleError.message}`);
    }

    await this.getSupabase().auth.admin.signOut(payload.userId);

    await this.auditLogService.logAudit({
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      action: "admin.user.remove",
      resourceType: "user",
      resourceId: payload.userId,
      details: {
        tenantId: payload.tenantId,
      },
      status: "success",
    });
  }
}

export const adminUserService = new AdminUserService();
