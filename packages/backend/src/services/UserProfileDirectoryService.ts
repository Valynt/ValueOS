import { createServerSupabaseClient } from "../lib/supabase.js"
import { logger } from "../lib/logger.js"

export interface CanonicalUserProfile {
  userUuid: string;
  tenantId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  creationSource: string;
  mfaEnrolled: boolean;
  deviceCount: number;
  deviceListReference: string;
}

export class UserProfileDirectoryService {
  private supabase = createServerSupabaseClient();

  async syncProfile(userUuid: string, tenantId?: string): Promise<void> {
    const { error } = await this.supabase.rpc("refresh_user_profile_directory", {
      p_user_id: userUuid,
      p_tenant_id: tenantId ?? null,
    });

    if (error) {
      logger.warn("Failed to sync user profile directory row", error, { userUuid, tenantId });
    }
  }

  async listTenantProfiles(tenantId: string): Promise<CanonicalUserProfile[]> {
    const { data, error } = await this.supabase
      .from("user_profile_directory")
      .select(
        "user_uuid, tenant_id, email, email_verified, display_name, role, status, last_login_at, creation_source, mfa_enrolled, device_count, device_list_reference"
      )
      .eq("tenant_id", tenantId)
      .order("display_name", { ascending: true });

    if (error) {
      throw new Error(`Failed to load user profiles: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      userUuid: row.user_uuid,
      tenantId: row.tenant_id,
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      lastLoginAt: row.last_login_at,
      creationSource: row.creation_source,
      mfaEnrolled: Boolean(row.mfa_enrolled),
      deviceCount: Number(row.device_count ?? 0),
      deviceListReference: row.device_list_reference,
    }));
  }
}

export const userProfileDirectoryService = new UserProfileDirectoryService();
