/**
 * Backend for Agents (BFA) Tool: Activate Customer
 *
 * This tool demonstrates the semantic decoupling pattern by providing
 * a high-level business operation for customer activation.
 */

import { z } from 'zod';
import { BaseSemanticTool } from '../base-tool';
import { AgentContext } from '../types';
import { supabase } from '../../lib/supabase';
import { logger } from '../../services/logging';

// Constants
const ACTIVATION_CODE_MIN_LENGTH = 6;

// Input schema for customer activation
const inputSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  activationCode: z.string().min(ACTIVATION_CODE_MIN_LENGTH, `Activation code must be at least ${ACTIVATION_CODE_MIN_LENGTH} characters`)
});

// Output schema for activation result
const outputSchema = z.object({
  success: z.boolean(),
  activatedAt: z.date(),
  welcomeMessage: z.string(),
  customerEmail: z.string().email()
});

/**
 * Semantic tool for activating customer accounts
 *
 * This tool encapsulates all the business logic for customer activation,
 * including validation, security checks, and database operations.
 */
export class ActivateCustomer extends BaseSemanticTool<
  typeof inputSchema._type,
  typeof outputSchema._type
> {
  id = 'activate_customer';
  description = 'Activate a customer account with comprehensive validation and business rules';

  inputSchema = inputSchema;
  outputSchema = outputSchema;

  policy = {
    resource: 'customer',
    action: 'activate',
    requiredPermissions: ['customer:activate', 'user:write']
  };

  /**
   * Telemetry configuration
   */
  telemetry = {
    trackMetrics: true,
    logInputs: false, // Don't log sensitive activation codes
    logOutputs: true
  };

  /**
   * Execute the customer activation business logic
   */
  protected async executeBusinessLogic(
    input: typeof inputSchema._type,
    context: AgentContext
  ): Promise<typeof outputSchema._type> {
    // Step 1: Validate business rules
    const customerData = await this.validateBusinessRules(input, context);

    // Step 2: Check tenant access
    await this.checkTenantAccess(context.tenantId, context);

    // Step 3: Perform database operation
    const result = await this.performActivation(input, customerData, context);

    // Step 4: Send welcome notification (could be async/background)
    await this.sendWelcomeNotification(result.customerEmail, context);

    return result;
  }

  /**
   * Validate business rules for customer activation
   */
  private async validateBusinessRules(
    input: typeof inputSchema._type,
    context: AgentContext
  ): Promise<{ customerEmail: string; activationCodeExpiresAt: string | null }> {
    // Business Rule 1: Customer must exist and belong to the tenant
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, status, activation_code, activation_code_expires_at')
      .eq('id', input.customerId)
      .eq('tenant_id', context.tenantId)
      .single();

    if (customerError || !customer) {
      throw this.createBusinessError(
        `Customer ${input.customerId} not found or not accessible`,
        'customer_not_found'
      );
    }

    // Business Rule 2: Customer must be in pending status
    if (customer.status !== 'pending') {
      throw this.createBusinessError(
        `Customer is not in pending status (current: ${customer.status})`,
        'invalid_customer_status'
      );
    }

    // Business Rule 3: Activation code must match
    if (customer.activation_code !== input.activationCode) {
      logger.warn('Invalid activation code attempt', {
        customerId: input.customerId,
        userId: context.userId,
        tenantId: context.tenantId
      });
      throw this.createBusinessError(
        'Invalid activation code provided',
        'invalid_activation_code'
      );
    }

    // Business Rule 4: Activation code must not be expired
    if (customer.activation_code_expires_at) {
      const expiresAt = new Date(customer.activation_code_expires_at);
      if (expiresAt < new Date()) {
        throw this.createBusinessError(
          'Activation code has expired',
          'activation_code_expired'
        );
      }
    }

    return {
      customerEmail: customer.email,
      activationCodeExpiresAt: customer.activation_code_expires_at
    };
  }

  /**
   * Perform the actual customer activation
   */
  private async performActivation(
    input: typeof inputSchema._type,
    customerData: { customerEmail: string },
    context: AgentContext
  ): Promise<typeof outputSchema._type> {
    const activatedAt = new Date();

    // Update customer status in database
    const { data: _updatedCustomer, error } = await supabase
      .from('customers')
      .update({
        status: 'active',
        activated_at: activatedAt.toISOString(),
        activation_code: null, // Clear the activation code for security
        activation_code_expires_at: null,
        updated_at: activatedAt.toISOString(),
        updated_by: context.userId
      })
      .eq('id', input.customerId)
      .eq('tenant_id', context.tenantId)
      .select('id, email, status, activated_at')
      .single();

    if (error) {
      logger.error('Customer activation database error', error, {
        customerId: input.customerId,
        userId: context.userId,
        tenantId: context.tenantId
      });
      throw new Error(`Failed to activate customer: ${error.message}`);
    }

    // Generate welcome message
    const welcomeMessage = `Welcome to ValueOS, ${customerData.customerEmail}! Your account has been successfully activated.`;

    logger.info('Customer activated successfully', {
      customerId: input.customerId,
      userId: context.userId,
      tenantId: context.tenantId,
      activatedAt: activatedAt.toISOString()
    });

    return {
      success: true,
      activatedAt,
      welcomeMessage,
      customerEmail: customerData.customerEmail
    };
  }

  /**
   * Send welcome notification to the customer
   * This could be an email, SMS, or in-app notification
   */
  private async sendWelcomeNotification(
    customerEmail: string,
    context: AgentContext
  ): Promise<void> {
    try {
      // In a real implementation, this would integrate with a notification service
      // For now, just log the intent
      logger.info('Welcome notification queued', {
        customerEmail,
        tenantId: context.tenantId,
        triggeredBy: context.userId
      });

      // Example: Queue notification job
      // await notificationService.sendWelcomeEmail(customerEmail, context.tenantId);

    } catch (error) {
      // Don't fail the activation if notification fails
      logger.warn('Welcome notification failed (non-blocking)', error, {
        customerEmail,
        tenantId: context.tenantId
      });
    }
  }
}
