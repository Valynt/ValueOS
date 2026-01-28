/**
 * IngestionScheduler
 *
 * Schedules and triggers periodic ingestion jobs for authoritative data sources (SEC, BLS, etc).
 * Uses setInterval for MVP; production should use a robust job scheduler.
 */
import { MCPFinancialGroundTruthServer } from "../core/MCPServer";
import { logger } from "../../lib/logger";

export class IngestionScheduler {
  private server: MCPFinancialGroundTruthServer;
  private intervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(server: MCPFinancialGroundTruthServer, intervalMs = 1000 * 60 * 60) {
    // default: 1 hour
    this.server = server;
    this.intervalMs = intervalMs;
  }

  start() {
    if (!this.server["ingestionService"]) {
      logger.error("Ingestion service not initialized");
      return;
    }
    this.timer = setInterval(() => this.runJob(), this.intervalMs);
    logger.info("IngestionScheduler started", { intervalMs: this.intervalMs });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    logger.info("IngestionScheduler stopped");
  }

  async runJob() {
    try {
      // Example: Ingest Apple Inc. (CIK 0000320193) for FY2024, revenue_total
      const cik = "0000320193";
      const period = "FY2024";
      const metrics = ["revenue_total"];
      const tenantId = "demo-org";
      await this.server["ingestionService"].ingestSECData(cik, period, metrics, tenantId);
      logger.info("Ingestion job completed", { cik, period, metrics, tenantId });
    } catch (error) {
      logger.error("Ingestion job failed", { error });
    }
  }
}
