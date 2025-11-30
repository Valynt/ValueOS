/**
 * Core Stripe Service
 * Singleton wrapper for Stripe API client with error handling
 */

import Stripe from 'stripe';
import { STRIPE_CONFIG } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'StripeService' });

class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    if (!STRIPE_CONFIG.secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    this.stripe = new Stripe(STRIPE_CONFIG.secretKey, {
      apiVersion: STRIPE_CONFIG.apiVersion,
      typescript: true,
      maxNetworkRetries: 3,
      timeout: 30000,
    });

    logger.info('Stripe service initialized');
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public getClient(): Stripe {
    return this.stripe;
  }

  /**
   * Handle Stripe API errors consistently
   */
  public handleError(error: any, context: string): never {
    logger.error(`Stripe error in ${context}`, error);

    if (error.type === 'StripeCardError') {
      throw new Error(`Card error: ${error.message}`);
    } else if (error.type === 'StripeRateLimitError') {
      throw new Error('Too many requests to Stripe API. Please try again later.');
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new Error(`Invalid request: ${error.message}`);
    } else if (error.type === 'StripeAPIError') {
      throw new Error('Stripe API error. Please try again later.');
    } else if (error.type === 'StripeConnectionError') {
      throw new Error('Connection error. Please check your internet connection.');
    } else if (error.type === 'StripeAuthenticationError') {
      throw new Error('Stripe authentication failed. Please contact support.');
    }

    throw new Error(`Stripe error: ${error.message || 'Unknown error'}`);
  }

  /**
   * Generate idempotency key
   */
  public generateIdempotencyKey(prefix: string, uniqueId: string): string {
    return `${prefix}_${uniqueId}_${Date.now()}`;
  }
}

export default StripeService;
