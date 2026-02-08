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
      html: `<div id="root"><div class='min-h-screen flex items-center justify-center bg-background'><svg class='animate-spin w-8 h-8 text-primary' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'><circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4'></circle><path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z'></path></svg></div></div>`,
    };
  }
}
