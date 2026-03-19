/**
 * Repository Implementation
 */

import { logger } from '../lib/logger.js';
import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

export class ValueCommitRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  async findById(id: string): Promise<unknown> {
    logger.debug('ValueCommitRepository findById', { id });
    return null;
  }

  async create(data: unknown): Promise<unknown> {
    logger.debug('ValueCommitRepository create', { data });
    return data;
  }
}

export const instance = new ValueCommitRepository();
