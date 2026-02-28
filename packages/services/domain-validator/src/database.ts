/**
 * Database operations for domain verification
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from './config';
import { logger } from './logger';

export interface CustomDomain {
  id: string;
  tenant_id: string;
  domain: string;
  verified: boolean;
  verification_token: string;
  verification_method: string;
  ssl_status: string;
  created_at: string;
  verified_at: string | null;
}

export class DomainDatabase {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Check if a domain is verified in the database
   */
  async isDomainVerified(domain: string): Promise<boolean> {
    try {
      const startTime = Date.now();

      const { data, error } = await this.client
        .from('custom_domains')
        .select('id, verified, tenant_id')
        .eq('domain', domain)
        .eq('verified', true)
        .single();

      const duration = Date.now() - startTime;

      if (error) {
        // Domain not found is expected, not an error
        if (error.code === 'PGRST116') {
          logger.debug('Domain not found', { domain, duration });
          return false;
        }

        logger.error('Database query error', {
          domain,
          error: error.message,
          code: error.code,
          duration,
        });
        throw error;
      }

      if (!data) {
        logger.debug('Domain not verified', { domain, duration });
        return false;
      }

      logger.info('Domain verified', {
        domain,
        tenantId: data.tenant_id,
        duration,
      });

      return true;
    } catch (error) {
      logger.error('Failed to check domain verification', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get domain details
   */
  async getDomain(domain: string): Promise<CustomDomain | null> {
    try {
      const { data, error } = await this.client
        .from('custom_domains')
        .select('*')
        .eq('domain', domain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as CustomDomain;
    } catch (error) {
      logger.error('Failed to get domain', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get count of verified domains
   */
  async getVerifiedDomainsCount(): Promise<number> {
    try {
      const { count, error } = await this.client
        .from('custom_domains')
        .select('*', { count: 'exact', head: true })
        .eq('verified', true);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('Failed to get verified domains count', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Health check - verify database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('custom_domains')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Singleton instance
export const domainDatabase = new DomainDatabase();
