/**
 * OpenTelemetry Instrumentation Initialization
 * 
 * This file must be imported before any other application code
 * to ensure proper instrumentation of all modules.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { initializeTelemetry } from '../../config/telemetry';
import { logger } from '../logger';

let sdk: NodeSDK | null = null;

/**
 * Initialize observability stack
 * Call this at application startup
 */
export function initializeObservability(): void {
  try {
    // Only initialize in Node.js environment (backend)
    if (typeof window === 'undefined') {
      sdk = initializeTelemetry();
      logger.info('Observability initialized', {
        component: 'instrumentation',
        telemetry: 'enabled'
      });
    } else {
      logger.debug('Skipping OpenTelemetry initialization in browser');
    }
  } catch (error) {
    logger.error('Failed to initialize observability', error as Error, {
      component: 'instrumentation'
    });
  }
}

/**
 * Shutdown observability stack gracefully
 */
export async function shutdownObservability(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('Observability shut down successfully');
    } catch (error) {
      logger.error('Error shutting down observability', error as Error);
    }
  }
}

/**
 * Check if observability is enabled
 */
export function isObservabilityEnabled(): boolean {
  return sdk !== null;
}
