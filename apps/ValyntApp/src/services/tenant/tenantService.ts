import { api } from "../api/client";

import type { Tenant, TenantSettings } from "./types";

class TenantService {
  private currentTenant: Tenant | null = null;

  async getCurrentTenant(): Promise<Tenant | null> {
    if (this.currentTenant) return this.currentTenant;

    try {
      this.currentTenant = await api.get<Tenant>("/tenant");
      return this.currentTenant;
    } catch {
      return null;
    }
  }

  async updateSettings(settings: Partial<TenantSettings>): Promise<Tenant> {
    const tenant = await api.patch<Tenant>("/tenant/settings", settings);
    this.currentTenant = tenant;
    return tenant;
  }

  async getMembers(): Promise<unknown[]> {
    return api.get("/tenant/members");
  }

  async inviteMember(email: string, role: string): Promise<void> {
    await api.post("/tenant/members/invite", { email, role });
  }

  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/tenant/members/${memberId}`);
  }

  clearCache(): void {
    this.currentTenant = null;
  }
}

export const tenantService = new TenantService();
