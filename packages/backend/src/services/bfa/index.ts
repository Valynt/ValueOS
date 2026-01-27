/**
 * Backend for Agents (BFA) Module
 * 
 * Semantic decoupling layer between agents and domain services.
 * Provides high-level business operations with security, validation, and telemetry.
 */

export * from './types.js'
export * from './registry.js'
export * from './auth-guard.js'
export * from './telemetry.js'
export * from './base-tool.js'

// Re-export commonly used utilities
export { toolRegistry } from './registry.js'
export { AuthGuard } from './auth-guard.js'
export { BfaTelemetry } from './telemetry.js'
