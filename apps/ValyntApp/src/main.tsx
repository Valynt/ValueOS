import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { bootstrap } from "./app/bootstrap";
import "./styles/globals.css";
import { analyticsClient } from "./lib/analyticsClient";
import { validateFrontendStartupEnv } from "./config/startupEnvValidator";
import { logger } from "./lib/logger";

// Debug: Log env values before validation
console.log("[DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("[DEBUG] VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + "...");

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
