import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger';
import { MemorySystem } from './MemorySystem';

export class MemoryGarbageCollector {
  private running = false;

  constructor(private memorySystem: MemorySystem, private supabase: SupabaseClient) {}

  async runOnce(limit: number = 1000): Promise<number> {
    try {
      const deleted = await this.memorySystem.pruneExpiredMemories(limit);
      logger.info('Memory garbage collection completed', { deleted });
      return deleted;
    } catch (err) {
      logger.error('Memory garbage collection failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  async runPeriodic(intervalMs: number = 1000 * 60 * 5): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info('Starting periodic memory garbage collector', { intervalMs });

    while (this.running) {
      try {
        await this.runOnce();
      } catch (e) {
        logger.error('Periodic memory GC run failed', { error: e instanceof Error ? e.message : String(e) });
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  stop(): void {
    this.running = false;
    logger.info('Stopping memory garbage collector');
  }
}
