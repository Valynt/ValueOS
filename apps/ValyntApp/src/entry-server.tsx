import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { bootstrap } from "./app/bootstrap";
import "./styles/globals.css";

export async function render() {
  // Bootstrap application
  const bootstrapResult = await bootstrap({
    onProgress: (msg) => console.log(`⏳ ${msg}`),
    onWarning: (msg) => console.warn(`⚠️ ${msg}`),
    onError: (msg) => console.error(`❌ ${msg}`),
  });

  if (!bootstrapResult.success) {
    console.error("Bootstrap failed:", bootstrapResult.errors);
  }

  const html = renderToString(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  return { html };
}
