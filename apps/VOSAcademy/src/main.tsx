import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { TrpcProvider } from "./lib/trpc";

// Unregister service workers immediately to fix WebContainer conflicts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TrpcProvider>
      <App />
    </TrpcProvider>
  </React.StrictMode>
);
