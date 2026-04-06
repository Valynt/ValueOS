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
    logger.error("[shutdown] Graceful shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error("[shutdown] Error in shutdown handler:", { error });
      }
    }

    clearTimeout(timeout);
    logger.info("[shutdown] Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error("[shutdown] Fatal error during shutdown:", { error });
    process.exit(1);
  }
}

// Register process signal handlers
process.on("SIGTERM", () => executeShutdown("SIGTERM"));
process.on("SIGINT", () => executeShutdown("SIGINT"));

function serializeShutdownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: String(error),
  };
}

// Handle uncaught errors
process.on("uncaughtException", error => {
  logger.error("[shutdown] Uncaught exception:", serializeShutdownError(error));
  executeShutdown("uncaughtException");
});

process.on("unhandledRejection", reason => {
  logger.error(
    "[shutdown] Unhandled rejection:",
    serializeShutdownError(reason)
  );
  executeShutdown("unhandledRejection");
});
