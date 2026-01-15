/**
 * VALYNT Application Entry Point
 *
 * Optimized for fast initial load:
 * - Fonts loaded asynchronously after initial render
 * - Critical styles loaded synchronously
 * - Bootstrap sequence managed by BootstrapGuard
 */

import { logger } from "./lib/logger";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRoutes from "./app/routes";
import "./styles/globals.css";
import "./styles/focus-visible.css";
import "./styles/micro-interactions.css";
import "./styles/responsive.css";
import { isDevelopment } from "./config/environment";
import { startConsoleCapture } from "./utils/consoleRecorder";
import { analyticsClient } from "./lib/analyticsClient";
import { initHMRFallback } from "./lib/vite-hmr-fallback";
import * as ClientRateLimit from "./services/ClientRateLimit";
import { BootstrapGuard } from "./components/Common/BootstrapGuard";
import { RootErrorBoundary } from "./components/error-boundaries/RootErrorBoundary";
import { StartupStatus } from "./components/Common/StartupStatus";
import { DevHUD } from "./components/dev/DevHUD";

/**
 * Load fonts asynchronously after initial render
 * This prevents blocking the login page from appearing
 */

const FONT_LOAD_DELAY = 100;

const loadFontsAsync = async () => {
  try {
    await Promise.all([
      import("@fontsource/inter/400.css"),
      import("@fontsource/inter/500.css"),
      import("@fontsource/inter/600.css"),
      import("@fontsource/inter/700.css"),
      import("@fontsource/jetbrains-mono/400.css"),
      import("@fontsource/jetbrains-mono/500.css"),
      import("@fontsource/jetbrains-mono/600.css"),
    ]);
    logger.debug("Custom fonts loaded");
  } catch (error) {
    logger.warn("Failed to load custom fonts, using system fonts");
    console.warn(error);
  }
};

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
    ClientRateLimit.setupDefaultRateLimits?.();

    if (isDevelopment()) {
      initHMRFallback();
    }

    startConsoleCapture();
    analyticsClient.initialize({ betaCohort: true });

    // 2. Render React Root immediately with error boundaries and startup status
    // This ensures something is always painted, even if dependencies are down
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <RootErrorBoundary>
          <StartupStatus
            onReady={() => logger.debug("All dependencies ready")}
            onDegraded={(state) =>
              logger.warn("Running in degraded mode", {
                warnings: state.warnings,
              })
            }
          >
            <BootstrapGuard>
              <AppRoutes />
            </BootstrapGuard>
          </StartupStatus>
          {isDevelopment() && <DevHUD />}
        </RootErrorBoundary>
      </StrictMode>
    );

    logger.debug("Application root rendered with BootstrapGuard");

    // 3. Load fonts asynchronously after React has rendered
    // This allows the login page to appear immediately with system fonts
    setTimeout(() => {
      loadFontsAsync();
    }, FONT_LOAD_DELAY);
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
