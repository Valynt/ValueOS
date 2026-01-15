/**
 * Startup System
 *
 * Exports for the graceful degradation boot system.
 * Includes anti-fragility features:
 * - Ghost Mode (auto-MSW)
 * - Runtime Config Injection
 * - Smart Remediation
 */

export * from "./types";
export * from "./dependency-checker";
export * from "./ghost-mode";
export * from "./runtime-config";
export * from "./smart-remediation";
