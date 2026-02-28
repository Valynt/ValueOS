import { createHash, randomBytes } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  AccessGrant,
  AccessGrantTier,
  GrantCreationParams,
  UUID,
  ValidationResult,
} from "./types";

const TOKEN_EXPIRY_DEFAULT_DAYS = 7;
const HASH_ALGORITHM = "sha256";

export class AccessService {
  constructor(private supabase: SupabaseClient) {}

  async createGrant(
    params: GrantCreationParams
  ): Promise<{ grant: AccessGrant; clearToken: string }> {
    await this.verifyResourceOwnership(
      params.tenantId,
      params.resourceType,
      params.resourceId
    );

    const clearToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(clearToken);

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (params.expiresInDays ?? TOKEN_EXPIRY_DEFAULT_DAYS)
    );

    const { data, error } = await this.supabase
      .from("memory_access_grants")
      .insert({
        tenant_id: params.tenantId,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        grantee_email: params.granteeEmail.toLowerCase(),
        token_hash: tokenHash,
        tier: params.tier,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create access grant: ${error.message}`);

    return {
      grant: data as AccessGrant,
      clearToken,
    };
  }

  async validateGrant(token: string, email: string): Promise<ValidationResult> {
    const tokenHash = this.hashToken(token);

    const { data: grant, error } = await this.supabase
      .from("memory_access_grants")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("grantee_email", email.toLowerCase())
      .single();

    if (error || !grant) {
      return { isValid: false, error: "Invalid token or email association." };
    }

    if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
      return { isValid: false, error: "Access grant has expired." };
    }

    return { isValid: true, grant: grant as AccessGrant };
  }

  async executeAsGuest<T>(
    token: string,
    tenantId: UUID,
    action: () => Promise<T>
  ): Promise<T> {
    const tokenHash = this.hashToken(token);

    await this.supabase.rpc("set_config", {
      name: "app.guest_token",
      value: tokenHash,
      is_local: true,
    });

    return await action();
  }

  async revokeGrant(grantId: UUID, tenantId: UUID): Promise<void> {
    const { error } = await this.supabase
      .from("memory_access_grants")
      .delete()
      .eq("id", grantId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`Revocation failed: ${error.message}`);
  }

  async listGrants(
    tenantId: UUID,
    resourceType?: string
  ): Promise<AccessGrant[]> {
    let query = this.supabase
      .from("memory_access_grants")
      .select("*")
      .eq("tenant_id", tenantId);

    if (resourceType) {
      query = query.eq("resource_type", resourceType);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return data as AccessGrant[];
  }

  async getGrantByResource(
    tenantId: UUID,
    resourceType: string,
    resourceId: UUID
  ): Promise<AccessGrant[]> {
    const { data, error } = await this.supabase
      .from("memory_access_grants")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);

    if (error) throw error;
    return data as AccessGrant[];
  }

  async extendGrant(
    grantId: UUID,
    additionalDays: number
  ): Promise<AccessGrant> {
    const { data: existing, error: fetchError } = await this.supabase
      .from("memory_access_grants")
      .select("*")
      .eq("id", grantId)
      .single();

    if (fetchError || !existing) {
      throw new Error("Grant not found");
    }

    const currentExpiry = existing.expires_at
      ? new Date(existing.expires_at)
      : new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + additionalDays);

    const { data, error } = await this.supabase
      .from("memory_access_grants")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("id", grantId)
      .select()
      .single();

    if (error) throw error;
    return data as AccessGrant;
  }

  async updateGrantTier(
    grantId: UUID,
    newTier: AccessGrantTier
  ): Promise<AccessGrant> {
    const { data, error } = await this.supabase
      .from("memory_access_grants")
      .update({ tier: newTier })
      .eq("id", grantId)
      .select()
      .single();

    if (error) throw error;
    return data as AccessGrant;
  }

  private async verifyResourceOwnership(
    tenantId: UUID,
    type: string,
    id: UUID
  ): Promise<void> {
    const tableMap: Record<string, string> = {
      value_case: "memory_value_cases",
      artifact: "memory_artifacts",
      narrative: "memory_narratives",
    };

    const tableName = tableMap[type];
    if (!tableName) throw new Error(`Unsupported resource type: ${type}`);

    const { data, error } = await this.supabase
      .from(tableName)
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      throw new Error(
        `Unauthorized: Resource ${id} does not exist in tenant ${tenantId}`
      );
    }
  }

  private hashToken(token: string): string {
    return createHash(HASH_ALGORITHM).update(token).digest("hex");
  }
}
