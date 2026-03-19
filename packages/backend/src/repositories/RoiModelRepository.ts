/**
 * Repository Implementation
 */

import { logger } from '../lib/logger.js';
import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

export class RoiModelRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  async findById(id: string): Promise<unknown> {
    logger.debug('RoiModelRepository findById', { id });
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    logger.debug('RoiModelRepository create', { data });
    return data;
  }
}

export const instance = new RoiModelRepository();
