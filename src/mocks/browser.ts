/**
 * MSW Browser Setup
 *
 * Mock Service Worker configuration for Ghost Mode.
 * This file is dynamically imported when Ghost Mode activates.
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockServiceWorker() {
  if (typeof window === "undefined") {
    return;
  }

  return worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: {
      url: "/mockServiceWorker.js",
    },
  });
}

export async function stopMockServiceWorker() {
  return worker.stop();
}
