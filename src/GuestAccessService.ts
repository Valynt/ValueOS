/**
 * Guest Access Service
 *
 * Manages guest user authentication, magic link generation,
 * and permission-based access to value cases.
 */

import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";
import crypto from "crypto";

// Database row types for guest access tables
interface GuestUserRow {
  id: string;
  email: string;
  name: string;
  company: string | null;
  role: string | null;
  created_by: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface GuestAccessTokenRow {
  id: string;
  guest_user_id: string;
  value_case_id: string;
  token: string;
  permissions: GuestPermissions;
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
  ip_address: string | null;
  user_agent: string | null;
  revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface GuestActivityRow {
  id: string;
  guest_user_id: string;
  guest_access_token_id: string;
  value_case_id: string;
  activity_type: GuestActivityType;
  activity_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Guest user interface
export interface GuestUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  createdBy: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

// Guest permissions interface
export interface GuestPermissions {
  can_view: boolean;
  can_comment: boolean;
  can_edit: boolean;
}

// Guest access token interface
export interface GuestAccessToken {
  id: string;
  guestUserId: string;
  valueCaseId: string;
  token: string;
  permissions: GuestPermissions;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  ipAddress?: string;
  userAgent?: string;
  revoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  guestUserId?: string;
  valueCaseId?: string;
  permissions?: GuestPermissions;
  guestName?: string;
  guestEmail?: string;
  errorMessage?: string;
}

// Guest activity type
export type GuestActivityType =
  | "access"
  | "view_element"
  | "add_comment"
  | "view_metric"
  | "export_pdf"
  | "export_excel"
  | "share_email";

// Guest activity interface
export interface GuestActivity {
  id: string;
  guestUserId: string;
  guestAccessTokenId: string;
  valueCaseId: string;
  activityType: GuestActivityType;
  activityData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Create guest user options
export interface CreateGuestUserOptions {
  email: string;
  name: string;
  company?: string;
  role?: string;
  organizationId: string;
}

// Create guest token options
export interface CreateGuestTokenOptions {
  guestUserId: string;
  valueCaseId: string;
  permissions?: Partial<GuestPermissions>;
  expiresInDays?: number;
}

class GuestAccessService {
  private readonly defaultExpirationDays = 30;
  private readonly defaultPermissions: GuestPermissions = {
    can_view: true,
    can_comment: false,
    can_edit: false,
  };

  /**
   * Create a guest user
   */
  public async createGuestUser(
    options: CreateGuestUserOptions
  ): Promise<GuestUser> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser.user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("guest_users")
        .insert({
          email: options.email.toLowerCase(),
          name: options.name,
          company: options.company,
          role: options.role,
          organization_id: options.organizationId,
          created_by: currentUser.user.id,
        })
        .select()
        .single();

      if (error) {
        // Check for unique constraint violation
        if (error.code === "23505") {
          // Guest user already exists, fetch and return
          const { data: existingUser, error: fetchError } = await supabase
            .from("guest_users")
            .select()
            .eq("email", options.email.toLowerCase())
            .eq("organization_id", options.organizationId)
            .single();

          if (fetchError) throw fetchError;
          return this.mapDatabaseToGuestUser(existingUser);
        }
        throw error;
      }

      logger.info("Guest user created", {
        guestUserId: data.id,
        email: options.email,
        organizationId: options.organizationId,
      });

      return this.mapDatabaseToGuestUser(data);
    } catch (error) {
      logger.error("Failed to create guest user", error as Error);
      throw error;
    }
  }

  /**
   * Generate a magic link token for guest access
   */
  public async createGuestToken(
    options: CreateGuestTokenOptions
  ): Promise<{ token: GuestAccessToken; magicLink: string }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser.user) {
        throw new Error("Not authenticated");
      }

      // Generate secure token
      const token = this.generateSecureToken();

      // Calculate expiration
      const expiresInDays = options.expiresInDays || this.defaultExpirationDays;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Merge permissions with defaults
      const permissions = {
        ...this.defaultPermissions,
        ...options.permissions,
      };

      const { data, error } = await supabase
        .from("guest_access_tokens")
        .insert({
          guest_user_id: options.guestUserId,
          value_case_id: options.valueCaseId,
          token,
          permissions,
          expires_at: expiresAt.toISOString(),
          created_by: currentUser.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const tokenData = this.mapDatabaseToToken(data);
      const magicLink = this.generateMagicLink(token);

      logger.info("Guest token created", {
        tokenId: data.id,
        guestUserId: options.guestUserId,
        valueCaseId: options.valueCaseId,
        expiresAt: expiresAt.toISOString(),
      });

      return { token: tokenData, magicLink };
    } catch (error) {
      logger.error("Failed to create guest token", error as Error);
      throw error;
    }
  }

  /**
   * Validate a guest access token
   */
  public async validateToken(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TokenValidationResult> {
    try {
      const { data, error } = await supabase.rpc("validate_guest_token", {
        token_value: token,
      });

      if (error) throw error;

      const result = data[0];

      if (!result.is_valid) {
        logger.warn("Invalid guest token", {
          token: token.substring(0, 10) + "...",
          error: result.error_message,
        });

        return {
          isValid: false,
          errorMessage: result.error_message,
        };
      }

      // Update IP and user agent if provided
      if (ipAddress || userAgent) {
        await supabase
          .from("guest_access_tokens")
          .update({
            ip_address: ipAddress,
            user_agent: userAgent,
          })
          .eq("token", token);
      }

      logger.info("Guest token validated", {
        guestUserId: result.guest_user_id,
        valueCaseId: result.value_case_id,
      });

      return {
        isValid: true,
        guestUserId: result.guest_user_id,
        valueCaseId: result.value_case_id,
        permissions: result.permissions,
        guestName: result.guest_name,
        guestEmail: result.guest_email,
      };
    } catch (error) {
      logger.error("Failed to validate guest token", error as Error);
      throw error;
    }
  }

  /**
   * Revoke a guest access token
   */
  public async revokeToken(token: string, reason?: string): Promise<boolean> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser.user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.rpc("revoke_guest_token", {
        token_value: token,
        revoked_by_user: currentUser.user.id,
        reason: reason || "Revoked by user",
      });

      if (error) throw error;

      logger.info("Guest token revoked", {
        token: token.substring(0, 10) + "...",
        reason,
      });

      return data;
    } catch (error) {
      logger.error("Failed to revoke guest token", error as Error);
      throw error;
    }
  }

  /**
   * Get guest user by ID
   */
  public async getGuestUser(guestUserId: string): Promise<GuestUser | null> {
    try {
      const { data, error } = await supabase
        .from("guest_users")
        .select()
        .eq("id", guestUserId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return this.mapDatabaseToGuestUser(data);
    } catch (error) {
      logger.error("Failed to get guest user", error as Error);
      throw error;
    }
  }

  /**
   * Get guest tokens for a value case
   */
  public async getTokensForValueCase(
    valueCaseId: string
  ): Promise<GuestAccessToken[]> {
    try {
      const { data, error } = await supabase
        .from("guest_access_tokens")
        .select()
        .eq("value_case_id", valueCaseId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(this.mapDatabaseToToken);
    } catch (error) {
      logger.error("Failed to get guest tokens", error as Error);
      throw error;
    }
  }

  /**
   * Log guest activity
   */
  public async logActivity(
    guestUserId: string,
    tokenId: string,
    valueCaseId: string,
    activityType: GuestActivityType,
    activityData?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.from("guest_activity_log").insert({
        guest_user_id: guestUserId,
        guest_access_token_id: tokenId,
        value_case_id: valueCaseId,
        activity_type: activityType,
        activity_data: activityData,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (error) throw error;

      logger.debug("Guest activity logged", {
        guestUserId,
        activityType,
      });
    } catch (error) {
      logger.error("Failed to log guest activity", error as Error);
      // Don't throw - activity logging should not break the main flow
    }
  }

  /**
   * Get guest activity for a value case
   */
  public async getActivityForValueCase(
    valueCaseId: string,
    limit: number = 100
  ): Promise<GuestActivity[]> {
    try {
      const { data, error } = await supabase
        .from("guest_activity_log")
        .select()
        .eq("value_case_id", valueCaseId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(this.mapDatabaseToActivity);
    } catch (error) {
      logger.error("Failed to get guest activity", error as Error);
      throw error;
    }
  }

  /**
   * Cleanup expired tokens
   */
  public async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc(
        "cleanup_expired_guest_tokens"
      );

      if (error) throw error;

      logger.info("Expired guest tokens cleaned up", { count: data });

      return data;
    } catch (error) {
      logger.error("Failed to cleanup expired tokens", error as Error);
      throw error;
    }
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    // Generate 32 bytes of random data
    const buffer = crypto.randomBytes(32);

    // Convert to base64url (URL-safe)
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Generate magic link URL
   */
  private generateMagicLink(token: string): string {
    const baseUrl = import.meta.env.VITE_APP_URL || "http://localhost:5173";
    return `${baseUrl}/guest/access?token=${token}`;
  }

  /**
   * Map database row to GuestUser
   */
  private mapDatabaseToGuestUser(row: GuestUserRow): GuestUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      company: row.company || undefined,
      role: row.role || undefined,
      createdBy: row.created_by,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to GuestAccessToken
   */
  private mapDatabaseToToken(row: GuestAccessTokenRow): GuestAccessToken {
    return {
      id: row.id,
      guestUserId: row.guest_user_id,
      valueCaseId: row.value_case_id,
      token: row.token,
      permissions: row.permissions,
      expiresAt: row.expires_at,
      lastAccessedAt: row.last_accessed_at || undefined,
      accessCount: row.access_count,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      revoked: row.revoked,
      revokedAt: row.revoked_at || undefined,
      revokedBy: row.revoked_by || undefined,
      revokeReason: row.revoke_reason || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to GuestActivity
   */
  private mapDatabaseToActivity(row: GuestActivityRow): GuestActivity {
    return {
      id: row.id,
      guestUserId: row.guest_user_id,
      guestAccessTokenId: row.guest_access_token_id,
      valueCaseId: row.value_case_id,
      activityType: row.activity_type,
      activityData: row.activity_data || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      createdAt: row.created_at,
    };
  }
}

// Singleton instance
let guestAccessServiceInstance: GuestAccessService | null = null;

/**
 * Get guest access service instance
 */
export function getGuestAccessService(): GuestAccessService {
  if (!guestAccessServiceInstance) {
    guestAccessServiceInstance = new GuestAccessService();
  }
  return guestAccessServiceInstance;
}

// Export singleton instance getter
export default getGuestAccessService;
