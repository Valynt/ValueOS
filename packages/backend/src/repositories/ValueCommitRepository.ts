/**
 * Repository Implementation
 */

import { createServerSupabaseClient } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export class ValueCommitRepository {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  async findById(id: string): Promise<any | null> {
    logger.debug('ValueCommitRepository findById', { id });
    return null;
  }

  async create(data: any): Promise<any> {
    logger.debug('ValueCommitRepository create', { data });
    return data;
  }
}

export const instance = new ValueCommitRepository();
