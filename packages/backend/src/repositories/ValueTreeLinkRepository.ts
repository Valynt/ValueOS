/**
 * Repository Implementation
 */

import { logger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';

export class ValueTreeLinkRepository {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  async findById(id: string): Promise<unknown> {
    logger.debug('ValueTreeLinkRepository findById', { id });
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    logger.debug('ValueTreeLinkRepository create', { data });
    return data;
  }
}

export const instance = new ValueTreeLinkRepository();
