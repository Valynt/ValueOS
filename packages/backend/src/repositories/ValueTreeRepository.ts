/**
 * '${repo}'
 */

import { createServerSupabaseClient } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export class ${repo} {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  async findById(id: string): Promise<any | null> {
    logger.debug('${repo} findById', { id });
    return null;
  }

  async create(data: any): Promise<any> {
    logger.debug('${repo} create', { data });
    return data;
  }
}

export const ${repo,,} = new ${repo}();
