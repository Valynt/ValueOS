/**
 * Backend for Agents (BFA) Module
 * 
 * Semantic decoupling layer between agents and domain services.
 * Provides high-level business operations with security, validation, and telemetry.
 */

export * from './types';
export * from './registry';
export * from './auth-guard';
export * from './telemetry';
export * from './base-tool';

// Re-export commonly used utilities
export { toolRegistry } from './registry';
export { AuthGuard } from './auth-guard';
export { BfaTelemetry } from './telemetry';
