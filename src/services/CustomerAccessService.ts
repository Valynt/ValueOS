/**
 * Customer Access Service
 * Manages secure token-based access for customer portal
 */

import { supabase } from '../lib/supabase';
import { BaseService } from './BaseService';
import { logger } from '../lib/logger';

export interface CustomerAccessToken {
  id: string;
  value_case_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface TokenValidationResult {
  value_case_id: string | null;
  is_valid: boolean;
  error_message: string | null;
}

export interface CreateTokenResult {
  token: string;
  expires_at: string;
  portal_url: string;
}

export class CustomerAccessService extends BaseService {
  constructor() {
    super('CustomerAccessService');
  }

  /**
   * Generate a new customer access token
   */
  async generateCustomerToken(
    valueCaseId: string,
    expiresInDays: number = 90
  ): Promise<CreateTokenResult> {
    try {
      this.logger.info('Generating customer token', { valueCaseId, expiresInDays });

      const { data, error } = await supabase.rpc('create_customer_access_token', {
        p_value_case_id: valueCaseId,
        p_expires_in_days: expiresInDays
      });

      if (error) {
        this.logger.error('Failed to generate customer token', error);
        throw new Error(`Failed to generate token: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No token returned from database');
      }

      const tokenData = data[0];
      const portalUrl = this.buildPortalUrl(tokenData.token);

      this.logger.info('Customer token generated successfully', {
        valueCaseId,
        expiresAt: tokenData.expires_at
      });

      return {
        token: tokenData.token,
        expires_at: tokenData.expires_at,
        portal_url: portalUrl
      };
    } catch (error) {
      this.logger.error('Error generating customer token', error as Error);
      throw error;
    }
  }

  /**
   * Validate a customer token
   */
  async validateCustomerToken(token: string): Promise<TokenValidationResult> {
    try {
      this.logger.debug('Validating customer token');

      const { data, error } = await supabase.rpc('validate_customer_token', {
        p_token: token
      });

      if (error) {
        this.logger.error('Failed to validate token', error);
        return {
          value_case_id: null,
          is_valid: false,
          error_message: error.message
        };
      }

      if (!data || data.length === 0) {
        return {
          value_case_id: null,
          is_valid: false,
          error_message: 'Invalid token'
        };
      }

      const result = data[0];

      if (result.is_valid) {
        this.logger.info('Token validated successfully', {
          valueCaseId: result.value_case_id
        });
      } else {
        this.logger.warn('Token validation failed', {
          error: result.error_message
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error validating token', error as Error);
      return {
        value_case_id: null,
        is_valid: false,
        error_message: 'Token validation error'
      };
    }
  }

  /**
   * Revoke a customer access token
   */
  async revokeCustomerToken(
    token: string,
    revokedBy: string,
    reason?: string
  ): Promise<boolean> {
    try {
      this.logger.info('Revoking customer token', { revokedBy, reason });

      const { data, error } = await supabase.rpc('revoke_customer_token', {
        p_token: token,
        p_revoked_by: revokedBy,
        p_reason: reason || null
      });

      if (error) {
        this.logger.error('Failed to revoke token', error);
        throw new Error(`Failed to revoke token: ${error.message}`);
      }

      const success = data === true;

      if (success) {
        this.logger.info('Token revoked successfully');
      } else {
        this.logger.warn('Token not found or already revoked');
      }

      return success;
    } catch (error) {
      this.logger.error('Error revoking token', error as Error);
      throw error;
    }
  }

  /**
   * Get all tokens for a value case
   */
  async getTokensForValueCase(valueCaseId: string): Promise<CustomerAccessToken[]> {
    try {
      const { data, error } = await supabase
        .from('customer_access_tokens')
        .select('*')
        .eq('value_case_id', valueCaseId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to fetch tokens', error);
        throw new Error(`Failed to fetch tokens: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error fetching tokens', error as Error);
      throw error;
    }
  }

  /**
   * Get active (non-revoked, non-expired) tokens for a value case
   */
  async getActiveTokensForValueCase(valueCaseId: string): Promise<CustomerAccessToken[]> {
    try {
      const { data, error } = await supabase
        .from('customer_access_tokens')
        .select('*')
        .eq('value_case_id', valueCaseId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to fetch active tokens', error);
        throw new Error(`Failed to fetch active tokens: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error fetching active tokens', error as Error);
      throw error;
    }
  }

  /**
   * Regenerate token (revoke old, create new)
   */
  async regenerateToken(
    oldToken: string,
    revokedBy: string,
    valueCaseId: string,
    expiresInDays: number = 90
  ): Promise<CreateTokenResult> {
    try {
      // Revoke old token
      await this.revokeCustomerToken(
        oldToken,
        revokedBy,
        'Token regenerated'
      );

      // Generate new token
      return await this.generateCustomerToken(valueCaseId, expiresInDays);
    } catch (error) {
      this.logger.error('Error regenerating token', error as Error);
      throw error;
    }
  }

  /**
   * Build portal URL from token
   */
  private buildPortalUrl(token: string): string {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${baseUrl}/customer/portal?token=${encodeURIComponent(token)}`;
  }

  /**
   * Send portal access email to customer
   */
  async sendPortalAccessEmail(
    email: string,
    companyName: string,
    portalUrl: string
  ): Promise<void> {
    try {
      this.logger.info('Sending portal access email', { email, companyName });

      // TODO: Integrate with email service
      // For now, just log the email details
      this.logger.info('Portal access email details', {
        to: email,
        subject: `Your ${companyName} Value Realization Portal`,
        portalUrl
      });

      // In production, integrate with SendGrid, Postmark, etc.
      // await emailService.send({
      //   to: email,
      //   template: 'customer-portal-access',
      //   data: { companyName, portalUrl }
      // });
    } catch (error) {
      this.logger.error('Error sending portal access email', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const customerAccessService = new CustomerAccessService();
