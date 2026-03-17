/**
 * Repository Implementation
 */

import { logger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';

export class RoiModelRepository {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
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
