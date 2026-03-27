import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { bootstrap } from "./app/bootstrap";
import "./styles/globals.css";
import { validateFrontendStartupEnv } from "./config/startupEnvValidator";
import { analyticsClient } from "./lib/analyticsClient";
import { logger } from "./lib/logger";
import { initFrontendObservability } from "./lib/observability";
import { bootstrapSDUITelemetry } from "./lib/telemetry/SDUITelemetry";

// Apply theme before first render to avoid flash of unstyled content.
// Default to dark; respect stored user preference if present.
(function applyTheme() {
  const stored = localStorage.getItem("theme");
  const isDark = stored ? stored !== "light" : true;
  document.documentElement.classList.toggle("dark", isDark);
  if (!stored) localStorage.setItem("theme", "dark");
})();

// Validate env values before startup
logger.debug("Startup env check", {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? "set" : "missing",
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? "set" : "missing",
});

validateFrontendStartupEnv(import.meta.env as Record<string, string | undefined>);

// Bootstrap application before rendering
bootstrap({
  onProgress: (msg) => logger.info(`⏳ ${msg}`),
  onWarning: (msg) => console.warn(`⚠️ ${msg}`),
  onError: (msg) => console.error(`❌ ${msg}`),
}).then((result) => {
  if (!result.success && import.meta.env.PROD) {
    console.error("Bootstrap failed:", result.errors);
  }

  bootstrapSDUITelemetry();
  analyticsClient.initialize({ betaCohort: true });

  initFrontendObservability({
    appName: "valynt-app",
    release: import.meta.env.VITE_RELEASE ?? "dev",
    environment: import.meta.env.MODE,
  });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
