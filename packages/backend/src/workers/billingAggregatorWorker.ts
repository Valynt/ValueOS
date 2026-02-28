import { createServer } from 'http';

import { createLogger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';
import { UsageQueueConsumerWorker } from '../services/metering/UsageQueueConsumerWorker.js';

const logger = createLogger({ component: 'BillingAggregatorWorker' });
const worker = new UsageQueueConsumerWorker(createServerSupabaseClient());

let healthy = true;
const healthPort = Number(process.env.BILLING_WORKER_HEALTH_PORT || '8082');

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
    logger.error('Health check failed', error as Error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error' }));
  }
});

const shutdown = async (signal: string) => {
  logger.info(`Billing aggregator worker received ${signal}, shutting down`);
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

healthServer.listen(healthPort, () => {
  logger.info(`Billing aggregator health endpoint listening on ${healthPort}`);
});

await worker.start();
