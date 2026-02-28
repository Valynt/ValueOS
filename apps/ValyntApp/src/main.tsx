import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { bootstrap } from "./app/bootstrap";
import "./styles/globals.css";
import { validateFrontendStartupEnv } from "./config/startupEnvValidator";
import { analyticsClient } from "./lib/analyticsClient";
import { logger } from "./lib/logger";

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

  analyticsClient.initialize({ betaCohort: true });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
