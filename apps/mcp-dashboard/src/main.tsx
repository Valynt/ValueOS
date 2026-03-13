import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";
import "./index.css";
import { initFrontendObservability } from "./lib/observability";

initFrontendObservability({
  appName: "mcp-dashboard",
  release: import.meta.env.VITE_RELEASE ?? "dev",
  environment: import.meta.env.MODE,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
