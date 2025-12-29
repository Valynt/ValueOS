import { logger } from "./lib/logger";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRoutes from "./AppRoutes.tsx";
import "./index.css";
import "./styles/focus-visible.css";
import "./styles/micro-interactions.css";
import "./styles/responsive.css";
import { isDevelopment } from "./config/environment";
import { startConsoleCapture } from "./utils/consoleRecorder";
import { analyticsClient } from "./lib/analyticsClient";
import { initHMRFallback } from "./lib/vite-hmr-fallback";
import * as ClientRateLimit from "./services/ClientRateLimit";
import { BootstrapGuard } from "./components/Common/BootstrapGuard";

/**
 * Application entry point with production-ready bootstrap
 */
function main() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element not found");
  }

  try {
    // 1. Initialize mission-critical telemetry and recovery systems first
    // These are initialized before bootstrap to capture any issues during the sequence
    ClientRateLimit.setupDefaultRateLimits?.();

    if (isDevelopment()) {
      initHMRFallback();
    }

    startConsoleCapture();
    analyticsClient.initialize({ betaCohort: true });

    // 2. Render React Root with BootstrapGuard
    // The Guard will handle the 8-step bootstrap sequence and UI states
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <BootstrapGuard>
          <AppRoutes />
        </BootstrapGuard>
      </StrictMode>
    );

    logger.debug("Application root rendered with BootstrapGuard");
  } catch (error) {
    logger.error(
      "Fatal error during application initialization",
      error instanceof Error ? error : new Error(String(error))
    );

    // High-fidelity fallback error UI
    rootElement.innerHTML = `
      <div class="vc-error-root">
        <div class="vc-error-card">
          <div class="vc-error-icon">❌</div>
          <div class="vc-error-title">Fatal Startup Error</div>
          <div class="vc-error-message">${error instanceof Error ? error.message : "An unexpected error occurred during bootstrap initiation."}</div>
        </div>
      </div>
    `;
  }
}

// Start the application
main();
