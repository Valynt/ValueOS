import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import { TrpcProvider } from "./lib/trpc";
import { initFrontendObservability } from "./lib/observability";

// Unregister service workers immediately to fix WebContainer conflicts
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

initFrontendObservability({
  appName: "vos-academy",
  release: import.meta.env.VITE_RELEASE ?? "dev",
  environment: import.meta.env.MODE,
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TrpcProvider>
      <App />
    </TrpcProvider>
  </React.StrictMode>
);
