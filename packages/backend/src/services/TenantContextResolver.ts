import { createLogger } from '../lib/logger.js'
import { TenantAwareService } from './TenantAwareService.js'

const logger = createLogger({ component: 'TenantContextResolver' });

export class TenantContextResolver extends TenantAwareService {
  constructor() {
    super('TenantContextResolver');
  }

  async hasTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const tenantIds = await this.getUserTenants(userId);
      return tenantIds.includes(tenantId);
    } catch (error) {
      logger.warn('Failed to resolve tenant access', error as Error, {
        userId,
        tenantId,
      });
      return false;
    }
  }
}
