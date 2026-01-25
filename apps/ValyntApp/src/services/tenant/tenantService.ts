import { api } from "../api/client";
import type { Tenant, TenantSettings } from "./types";
import { logger } from "../../lib/logger";
import { inputValidator } from "../InputValidation";
import { ValidationError } from "../errors";

class TenantService {
  private currentTenant: Tenant | null = null;
  private membersCache: unknown[] | null = null;
  private membersCacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeValidationRules();
  }

  private initializeValidationRules() {
    if (!inputValidator.getRule('tenant-invite-member')) {
      inputValidator.addRule({
        id: 'tenant-invite-member',
        name: 'Tenant Invite Member',
        description: 'Validates member invitation',
        schema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['owner', 'admin', 'member'] }
          },
          required: ['email', 'role'],
          additionalProperties: false
        }
      });
    }
  }

  async getCurrentTenant(): Promise<Tenant | null> {
    if (this.currentTenant) return this.currentTenant;

    try {
      this.currentTenant = await api.get<Tenant>("/tenant");
      return this.currentTenant;
    } catch (error) {
      logger.error("Failed to fetch current tenant", { error });
      return null;
    }
  }

  async updateSettings(settings: Partial<TenantSettings>): Promise<Tenant> {
    const tenant = await api.patch<Tenant>("/tenant/settings", settings);
    this.currentTenant = tenant;
    return tenant;
  }

  async getMembers(): Promise<unknown[]> {
    const now = Date.now();
    if (this.membersCache && (now - this.membersCacheTimestamp < this.CACHE_TTL)) {
      return this.membersCache;
    }

    try {
      const members = await api.get<unknown[]>("/tenant/members");
      this.membersCache = members;
      this.membersCacheTimestamp = now;
      return members;
    } catch (error) {
      logger.error("Failed to fetch tenant members", { error });
      throw error;
    }
  }

  async inviteMember(email: string, role: string): Promise<void> {
    const validation = inputValidator.validate('tenant-invite-member', { email, role });
    if (!validation.isValid) {
      const message = validation.errors ? validation.errors.join(', ') : 'Invalid invitation data';
      logger.warn("Invalid member invitation attempt", { email, role, errors: validation.errors });
      throw new ValidationError(message);
    }

    await api.post("/tenant/members/invite", { email, role });
    this.membersCache = null; // Invalidate cache
  }

  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/tenant/members/${memberId}`);
    this.membersCache = null; // Invalidate cache
  }

  clearCache(): void {
    this.currentTenant = null;
    this.membersCache = null;
    this.membersCacheTimestamp = 0;
  }
}

export const tenantService = new TenantService();
