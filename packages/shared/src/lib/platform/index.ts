/**
 * Platform Utilities Index
 *
 * Re-exports platform-specific utilities.
 * Import from specific submodules for tree-shaking:
 *
 * Browser: import { ... } from '@valueos/shared/platform/browser'
 * Server:  import { ... } from '@valueos/shared/platform/server'
 *
 * @module @valueos/shared/platform
 */

// Export browser utilities
export * from "./browser";

// Export server utilities
export * from "./server";

// Universal platform detection
export function getPlatform(): "browser" | "server" | "unknown" {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }
  if (typeof process !== "undefined" && process.versions?.node !== undefined) {
    return "server";
  }
  return "unknown";
}
