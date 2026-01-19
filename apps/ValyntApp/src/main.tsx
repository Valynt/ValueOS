import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { bootstrap } from "./app/bootstrap";
import "./styles/globals.css";
import { analyticsClient } from "./lib/analyticsClient";

// Bootstrap application before rendering
bootstrap({
  onProgress: (msg) => console.log(`⏳ ${msg}`),
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
