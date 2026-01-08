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
 * Load fonts asynchronously after initial render
 * This prevents blocking the login page from appearing
 */
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

// 🚀 DEBUG: Start Application Initialization
console.log(`[${new Date().toISOString()}] 🚀 Main: Starting application initialization...`);

/**
 * Application entry point with production-ready bootstrap
 */
function main() {
  console.log(`[${new Date().toISOString()}] 📦 Main: Finding root element...`);
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    console.error(`[${new Date().toISOString()}] ❌ Main: Root element not found!`);
    throw new Error("Root element not found");
  }

  try {
    // 1. Initialize mission-critical telemetry and recovery systems first
    console.log(`[${new Date().toISOString()}] 🛡️ Main: Setting up rate limits...`);
    ClientRateLimit.setupDefaultRateLimits?.();

    if (isDevelopment()) {
      console.log(`[${new Date().toISOString()}] 🔄 Main: Initializing HMR fallback...`);
      initHMRFallback();
    }

    console.log(`[${new Date().toISOString()}] 📊 Main: Initializing analytics...`);
    startConsoleCapture();
    analyticsClient.initialize({ betaCohort: true });

    // 2. Render React Root with BootstrapGuard
    // The Guard will handle the bootstrap sequence and UI states
    console.log(`[${new Date().toISOString()}] ⚛️ Main: Creating React Root...`);
    const root = createRoot(rootElement);

    console.log(`[${new Date().toISOString()}] 🎨 Main: Rendering <AppRoutes />...`);
    root.render(
      <StrictMode>
        <BootstrapGuard>
          <AppRoutes />
        </BootstrapGuard>
      </StrictMode>
    );

    console.log(`[${new Date().toISOString()}] ✅ Main: Render called successfully.`);
    logger.debug("Application root rendered with BootstrapGuard");

    // 3. Load fonts asynchronously after React has rendered
    // This allows the login page to appear immediately with system fonts
    setTimeout(() => {
      console.log(`[${new Date().toISOString()}] 🔤 Main: Loading fonts async...`);
      loadFontsAsync();
    }, 100);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 💥 Main: FATAL ERROR during init:`, error);
    logger.error(
      "Fatal error during application initialization",
      error instanceof Error ? error : new Error(String(error))
    );

    // High-fidelity fallback error UI
    rootElement.innerHTML = `
      <div style="padding: 2rem; color: white; background: #0f172a; height: 100vh; font-family: sans-serif;">
        <h1 style="color: #ef4444;">Fatal Startup Error</h1>
        <pre style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `;
  }
}

// Start the application
main();
