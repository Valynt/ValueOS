import { logger } from "../lib/logger";
import { IngestionScheduler } from "./services/IngestionScheduler";

import { createDevServer } from "./index";

async function main() {
  const server = await createDevServer();
  // Start ingestion scheduler (every hour)
  const scheduler = new IngestionScheduler(server, 1000 * 60 * 60);
  scheduler.start();
  logger.info("MCP Ground Truth Server and IngestionScheduler started");
}

main().catch(err => {
  logger.error("Fatal error in MCP bootstrap", { error: err });
  process.exit(1);
});
