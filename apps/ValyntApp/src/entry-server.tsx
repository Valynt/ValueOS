import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import "./styles/globals.css";

export async function render() {
  // For SSR, we need to handle bootstrap differently
  // Bootstrap may have browser-specific code, so we'll skip it for now
  // In production, you might want to initialize only server-safe parts

  try {
    const html = renderToString(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    return { html };
  } catch (error) {
    console.error("SSR rendering failed:", error);
    // Fallback to basic HTML
    return {
      html: `<div id="root">Loading...</div>`,
    };
  }
}
