/**
 * Admin User Service
 *
 * Handles tenant user administration with server-side permissions and audit logging.
 */

import { logger } from "../../lib/logger.js"
import { createServerSupabaseClient } from "../../lib/supabase.js"

import { AuditLogService } from "./AuditLogService.js"
import { authDirectoryService } from "./AuthDirectoryService.js"
import { ValidationError } from "./errors.js"
import { userProfileDirectoryService } from "./UserProfileDirectoryService.js"

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
  id?: string;
  userUuid: string;
  tenantId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  fullName?: string;
  role: string;
  createdAt?: string;
  status: "active" | "invited" | "suspended" | "deactivated" | "inactive";
  lastLoginAt: string | null;
  creationSource: string;
  mfaEnrolled: boolean;
  deviceCount: number;
  deviceListReference: string;
}

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

  /**
   * Throws if removing or demoting targetUserId would leave the tenant with
   * zero admin/owner members. Called before any removal or role downgrade.
   *
   * "Admin" is defined as role IN ('owner', 'admin') with status = 'active'
   * in user_tenants — the RLS authority table.
   */
  private async assertNotLastAdmin(
    targetUserId: string,
    tenantId: string,
    incomingRole?: TenantRole,
  ): Promise<void> {
    // Only relevant when the target currently holds an elevated role.
    const { data: current, error: currentErr } = await this.getSupabase()
      .from("user_tenants")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (currentErr) {
      throw new ValidationError(`Failed to verify current role: ${currentErr.message}`);
    }

    const isCurrentlyAdmin =
      current?.role === "owner" || current?.role === "admin";

    // If the user is not currently an admin/owner, no last-admin risk.
    if (!isCurrentlyAdmin) return;

    // If a new role is provided and it is also elevated, no risk.
    const isIncomingAdmin =
      incomingRole === "owner" || incomingRole === "admin";
    if (incomingRole !== undefined && isIncomingAdmin) return;

    // Count remaining active admins/owners excluding the target user.
    const { count, error: countErr } = await this.getSupabase()
      .from("user_tenants")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .neq("user_id", targetUserId);

    if (countErr) {
      throw new ValidationError(`Failed to count tenant admins: ${countErr.message}`);
    }

    if ((count ?? 0) === 0) {
      throw new ValidationError(
        "Cannot remove or demote the last admin. Assign another admin first.",
      );
    }
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
    const profiles = await userProfileDirectoryService.listTenantProfiles(tenantId);

    if (profiles.length > 0) {
      return profiles.map((profile) => ({
        userUuid: profile.userUuid,
        tenantId: profile.tenantId,
        email: profile.email,
        emailVerified: profile.emailVerified,
        displayName: profile.displayName,
        role: profile.role,
        status: profile.status as TenantUserRecord["status"],
        lastLoginAt: profile.lastLoginAt,
        creationSource: profile.creationSource,
        mfaEnrolled: profile.mfaEnrolled,
        deviceCount: profile.deviceCount,
        deviceListReference: profile.deviceListReference,
      }));
    }

    const { data, error } = await this.getSupabase()
      .from("user_tenants")
      .select("user_id, role, status")
      .eq("tenant_id", tenantId);

    if (error) {
      throw new ValidationError(`Failed to load tenant users: ${error.message}`);
    }

    const rows = data ?? [];
    const userIds = rows.map((r) => r.user_id);
    const authProfiles = await authDirectoryService.getProfilesByIds(userIds);

    return rows.map((row) => {
      const user = authProfiles.get(row.user_id);
      return {
        userUuid: row.user_id,
        tenantId,
        email: user?.email || "",
        emailVerified: false,
        displayName: user?.fullName || "User",
        role: row.role || "member",
        status: (row.status || "active") as TenantUserRecord["status"],
        lastLoginAt: user?.lastLoginAt ?? null,
        creationSource: "unknown",
        mfaEnrolled: false,
        deviceCount: 0,
        deviceListReference: "trusted_devices",
      };
    });
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

    await userProfileDirectoryService.syncProfile(user.id, payload.tenantId);

    const profiles = await userProfileDirectoryService.listTenantProfiles(payload.tenantId);
    const profile = profiles.find((entry) => entry.userUuid === user.id);

    return profile
      ? {
          userUuid: profile.userUuid,
          tenantId: profile.tenantId,
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          role: profile.role,
          status: profile.status as TenantUserRecord["status"],
          lastLoginAt: profile.lastLoginAt,
          creationSource: profile.creationSource,
          mfaEnrolled: profile.mfaEnrolled,
          deviceCount: profile.deviceCount,
          deviceListReference: profile.deviceListReference,
        }
      : {
          userUuid: user.id,
          tenantId: payload.tenantId,
          email: user.email || payload.email,
          emailVerified: false,
          displayName:
            (user.user_metadata?.full_name as string | undefined) || payload.email.split("@")[0],
          role,
          status: invited ? "invited" : "active",
          lastLoginAt: user.last_sign_in_at ?? null,
          creationSource: "invite",
          mfaEnrolled: false,
          deviceCount: 0,
          deviceListReference: "trusted_devices",
        };
  }

  async updateUserRole(actor: AdminActor, payload: UpdateRolePayload): Promise<void> {
    const role = this.normalizeRole(payload.role);

    await this.assertNotLastAdmin(payload.userId, payload.tenantId, role);

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
    await userProfileDirectoryService.syncProfile(payload.userId, payload.tenantId);

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
    await this.assertNotLastAdmin(payload.userId, payload.tenantId);

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
    await userProfileDirectoryService.syncProfile(payload.userId, payload.tenantId);

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
