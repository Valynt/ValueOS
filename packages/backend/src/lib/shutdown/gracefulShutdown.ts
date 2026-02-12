import { logger } from "../logger.js";
/**
 * Graceful Shutdown Handler
 * 
 * Manages cleanup operations when the process is terminating.
 * Ensures resources are released properly on SIGTERM/SIGINT.
 */

type ShutdownHandler = () => Promise<void> | void;

const shutdownHandlers: ShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Register a function to be called during graceful shutdown
 */
export function registerShutdownHandler(handler: ShutdownHandler): void {
  shutdownHandlers.push(handler);
}

/**
 * Execute all registered shutdown handlers
 */
async function executeShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.info(`[shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`[shutdown] Received ${signal}, starting graceful shutdown...`);

  const timeout = setTimeout(() => {
    console.error("[shutdown] Graceful shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error("[shutdown] Error in shutdown handler:", error);
      }
    }

    clearTimeout(timeout);
    logger.info("[shutdown] Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    console.error("[shutdown] Fatal error during shutdown:", error);
    process.exit(1);
  }
}

// Register process signal handlers
process.on("SIGTERM", () => executeShutdown("SIGTERM"));
process.on("SIGINT", () => executeShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[shutdown] Uncaught exception:", error);
  executeShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[shutdown] Unhandled rejection:", reason);
  executeShutdown("unhandledRejection");
});
