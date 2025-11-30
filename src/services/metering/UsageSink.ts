/**
 * Usage Sink
 * Submits aggregated usage to Stripe (runs as background job)
 */

import UsageMeteringService from '../billing/UsageMeteringService';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'UsageSink' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class UsageSink {
  /**
   * Submit pending aggregates to Stripe
   */
  async submitToStripe(): Promise<number> {
    logger.info('Starting Stripe submission');

    try {
      const submitted = await UsageMeteringService.submitPendingAggregates();
      
      if (submitted > 0) {
        logger.info(`Submitted ${submitted} aggregates to Stripe`);
      }

      return submitted;
    } catch (error) {
      logger.error('Stripe submission failed', error as Error);
      throw error;
    }
  }

  /**
   * Run complete metering pipeline
   * Called by cron job or scheduler
   */
  async runPipeline(): Promise<{
    submitted: number;
    errors: number;
  }> {
    logger.info('Running metering pipeline');

    let submitted = 0;
    let errors = 0;

    try {
      submitted = await this.submitToStripe();
    } catch (error) {
      errors++;
      logger.error('Pipeline error', error as Error);
    }

    logger.info('Pipeline complete', { submitted, errors });

    return { submitted, errors };
  }
}

export default new UsageSink();
