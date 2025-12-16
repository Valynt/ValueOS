import { logger } from "./lib/logger";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRoutes from "./AppRoutes.tsx";
import "./index.css";
import "./styles/focus-visible.css";
import "./styles/micro-interactions.css";
import "./styles/responsive.css";
import { bootstrap } from "./bootstrap";
import { isProduction, isDevelopment } from "./config/environment";
import { startConsoleCapture } from "./utils/consoleRecorder";
import { analyticsClient } from "./lib/analyticsClient";
import { initHMRFallback } from "./lib/vite-hmr-fallback";

/**
 * Application entry point with production-ready bootstrap
 */
async function main() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element not found");
  }

  // Show loading indicator (tokenized)
  rootElement.innerHTML = `
    <div class="vc-loading-root">
      <div class="vc-loading-inner">
        <div class="vc-loading-title">ValueCanvas</div>
        <div class="vc-loading-subtitle">Initializing application...</div>
        <div class="vc-loading-bar" aria-hidden="true">
          <div class="vc-loading-fill"></div>
        </div>
      </div>
    </div>
  `;

  try {
    // Initialize rate limiting
    setupDefaultRateLimits();

    // Initialize HMR fallback for reliable development experience
    if (isDevelopment()) {
      initHMRFallback();
    }

    // Initialize telemetry helpers
    startConsoleCapture();
    analyticsClient.initialize({ betaCohort: true });

    // Bootstrap the application
    logger.debug("Starting application bootstrap...");

    const result = await bootstrap({
      skipAgentCheck: false,
      failFast: isProduction(),
      onProgress: (message) => {
        logger.debug(`⏳ ${message}`);
      },
      onWarning: (warning) => {
        logger.warn(`⚠️  ${warning}`);
      },
      onError: (error) => {
        logger.error(`❌ ${error}`);
      },
    });

    // Check if bootstrap was successful
    if (!result.success && isProduction()) {
      // Show error screen in production
      rootElement.innerHTML = `
        <div class="vc-error-root">
          <div class="vc-error-card">
            <div class="vc-error-icon">⚠️</div>
            <div class="vc-error-title">Application Initialization Failed</div>
            <div class="vc-error-message">The application could not be initialized. Please contact support if this problem persists.</div>
            <div class="vc-error-details">
              <summary style="font-weight:600;">Error Details</summary>
              <ul style="margin: 0; padding-left: 20px;">
                ${result.errors.map((error) => `<li style="margin: 4px 0;">${error}</li>`).join("")}
              </ul>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Log warnings in development
    if (isDevelopment() && result.warnings.length > 0) {
      logger.warn("Bootstrap completed with warnings:");
      result.warnings.forEach((warning) => logger.warn(`  - ${warning}`));
    }

    // Render the application
    logger.debug("Rendering application...");

    const root = createRoot(rootElement);
    logger.debug("Root created, rendering React app...");
    root.render(
      <StrictMode>
        <AppRoutes />
      </StrictMode>
    );

    logger.debug("✅ Application rendered successfully");
  } catch (error) {
    logger.error(
      "Fatal error during application initialization",
      error instanceof Error ? error : new Error(String(error))
    );

    // Show error screen
    rootElement.innerHTML = `
      <div class="vc-error-root">
        <div class="vc-error-card">
          <div class="vc-error-icon">❌</div>
          <div class="vc-error-title">Fatal Error</div>
          <div class="vc-error-message">${error instanceof Error ? error.message : "An unexpected error occurred"}</div>
          ${
            isDevelopment()
              ? `
            <div class="vc-error-details">
              <summary style="font-weight:600;">Stack Trace</summary>
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-word;">${error instanceof Error ? error.stack : ""}</pre>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }
}

// Start the application
main().catch((error) => {
  logger.error("Unhandled error in main():", error);
});
