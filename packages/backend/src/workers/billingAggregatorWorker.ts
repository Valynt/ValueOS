import { createServer } from 'http';

import { createLogger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';
import { UsageQueueConsumerWorker } from '../services/metering/UsageQueueConsumerWorker.js';

const logger = createLogger({ component: 'BillingAggregatorWorker' });
const healthPort = Number(process.env.BILLING_WORKER_HEALTH_PORT || '8082');

let healthy = true;

export async function main(): Promise<void> {
  try {
    const supabaseClient = createServerSupabaseClient();
    const worker = new UsageQueueConsumerWorker(supabaseClient);

    const healthServer = createServer(async (_req, res) => {
      if (!healthy) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'shutting_down' }));
        return;
      }

      try {
        const lag = await worker.getLag();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', lag }));
      } catch (error) {
        logger.error('Health check failed', error, {
          stage: 'health_check',
          error_code: 'BILLING_WORKER_HEALTH_CHECK_FAILED',
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error' }));
      }
    });

    const shutdown = async (signal: string) => {
      logger.info(`Billing aggregator worker received ${signal}, shutting down`, {
        stage: 'shutdown',
      });
      healthy = false;
      healthServer.close();
      await worker.stop();
      process.exit(0);
    };

    process.once('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.once('SIGINT', () => {
      void shutdown('SIGINT');
    });

    await worker.start();

    healthServer.listen(healthPort, () => {
      logger.info(`Billing aggregator health endpoint listening on ${healthPort}`, {
        stage: 'health_server_listen',
      });
    });
  } catch (error) {
    logger.error('Billing aggregator startup failed', error, {
      stage: 'initialize',
      error_code: 'BILLING_WORKER_STARTUP_FAILED',
      component: 'BillingAggregatorWorker',
    });
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.endsWith('billingAggregatorWorker.ts')
  || process.argv[1]?.endsWith('billingAggregatorWorker.js');

if (isDirectRun) {
  void main();
}
