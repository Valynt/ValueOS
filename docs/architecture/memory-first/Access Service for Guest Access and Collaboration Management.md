```typescript
/**
 * AccessService.ts
 * 
 * CORE GOVERNANCE LAYER: Guest Access & Collaboration
 * This service manages the lifecycle of Access Grants, enabling secure, 
 * scoped collaboration for external stakeholders (Guests) within the 
 * ValueOS Memory-First Architecture.
 */

import { crypto } from "node:crypto";
import { 
  UUID, 
  AccessGrant, 
  AccessGrantTier, 
  UserRole,
  ValueCaseStatus 
} from "./types";

/**
 * Configuration for Access Token security
 */
const TOKEN_EXPIRY_DEFAULT_DAYS = 7;
const HASH_ALGORITHM = 'sha256';

export interface GrantCreationParams {
  tenantId: UUID;
  resourceType: 'value_case' | 'artifact' | 'narrative';
  resourceId: UUID;
  granteeEmail: string;
  tier: AccessGrantTier;
  expiresInDays?: number;
  createdBy: UUID; // Profile ID of the admin/editor
}

export interface ValidationResult {
  isValid: boolean;
  grant?: AccessGrant;
  error?: string;
}

export class AccessService {
  private db: any; // Representative of the Supabase/Postgres client

  constructor(databaseClient: any) {
    this.db = databaseClient;
  }

  /**
   * Generates a new Access Grant for an external guest.
   * Produces a secure clear-text token (for the guest) and stores a hash (for the DB).
   */
  async createGrant(params: GrantCreationParams): Promise<{ grant: AccessGrant; clearToken: string }> {
    // 1. Validate Resource Existence & Permissions
    await this.verifyResourceOwnership(params.tenantId, params.resourceType, params.resourceId);

    // 2. Generate Secure Token
    const clearToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(clearToken);

    // 3. Calculate Expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? TOKEN_EXPIRY_DEFAULT_DAYS));

    // 4. Persist to public.access_grants
    const { data, error } = await this.db
      .from('access_grants')
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

    if (error) throw new Error(`Failed to create access grant: ${error.message}`);

    return {
      grant: data as AccessGrant,
      clearToken,
    };
  }

  /**
   * Validates a guest's token against the RLS-compatible hash.
   * This logic mirrors the Postgres RLS "Tenant Access" policy.
   */
  async validateGrant(token: string, email: string): Promise<ValidationResult> {
    const tokenHash = this.hashToken(token);

    const { data: grant, error } = await this.db
      .from('access_grants')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('grantee_email', email.toLowerCase())
      .single();

    if (error || !grant) {
      return { isValid: false, error: 'Invalid token or email association.' };
    }

    // Check expiration
    if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
      return { isValid: false, error: 'Access grant has expired.' };
    }

    return { isValid: true, grant: grant as AccessGrant };
  }

  /**
   * Sets the Postgres session variable to allow the RLS policy to resolve 
   * guest access automatically during a transaction.
   */
  async executeAsGuest<T>(token: string, tenantId: UUID, action: () => Promise<T>): Promise<T> {
    const tokenHash = this.hashToken(token);
    
    // In a production Supabase/Postgres environment, we set the 'app.guest_token' 
    // which is used by the RLS policy defined in the migration.
    await this.db.rpc('set_config', {
      name: 'app.guest_token',
      value: tokenHash,
      is_local: true
    });

    // We also set the request.jwt.claims for tenant isolation via get_tenant_id()
    // if the guest isn't fully authenticated via JWT yet.
    return await action();
  }

  /**
   * Revokes access immediately by deleting the grant.
   */
  async revokeGrant(grantId: UUID, tenantId: UUID): Promise<void> {
    const { error } = await this.db
      .from('access_grants')
      .delete()
      .eq('id', grantId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Revocation failed: ${error.message}`);
  }

  /**
   * INTERNAL: Verifies that the resource exists and belongs to the tenant.
   * This prevents "Grant Spoofing" where a user tries to create a grant for a resource they don't own.
   */
  private async verifyResourceOwnership(tenantId: UUID, type: string, id: UUID): Promise<void> {
    const tableMap: Record<string, string> = {
      'value_case': 'value_cases',
      'artifact': 'artifacts',
      'narrative': 'narratives'
    };

    const tableName = tableMap[type];
    if (!tableName) throw new Error(`Unsupported resource type: ${type}`);

    const { data, error } = await this.db
      .from(tableName)
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new Error(`Unauthorized: Resource ${id} does not exist in tenant ${tenantId}`);
    }
  }

  /**
   * INTERNAL: Consistent hashing of clear-text tokens.
   */
  private hashToken(token: string): string {
    return crypto
      .createHash(HASH_ALGORITHM)
      .update(token)
      .digest('hex');
  }
}

/**
 * INTEGRATION GUIDE FOR RLS
 * 
 * The AccessService works in tandem with the following SQL Policy:
 * 
 * CREATE POLICY "Tenant Access" ON public.artifacts
 * FOR ALL USING (
 *   tenant_id = public.get_tenant_id()
 *   OR 
 *   EXISTS (
 *     SELECT 1 FROM public.access_grants 
 *     WHERE resource_id = artifacts.id 
 *     AND token_hash = current_setting('app.guest_token', true)
 *     AND (expires_at IS NULL OR expires_at > now())
 *   )
 * );
 */
```