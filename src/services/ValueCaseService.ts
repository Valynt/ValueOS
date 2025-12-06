/**
 * Value Case Service
 * 
 * Manages value cases for the Chat + Canvas UI.
 * Fetches from Supabase and provides real-time updates.
 */

import { logger } from '../lib/logger';
import type { LifecycleStage } from '../types/vos';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { TenantAwareService, type TenantContext } from './TenantAwareService';

// ============================================================================
// Types
// ============================================================================

export interface ValueCase {
  id: string;
  name: string;
  description?: string;
  company: string;
  stage: LifecycleStage;
  status: 'in-progress' | 'completed' | 'paused';
  quality_score?: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, unknown>;
}

export interface ValueCaseCreate {
  name: string;
  description?: string;
  company: string;
  website?: string;
  stage?: LifecycleStage;
  status?: 'in-progress' | 'completed' | 'paused';
  metadata?: Record<string, unknown>;
}

export interface ValueCaseUpdate {
  name?: string;
  description?: string;
  company?: string;
  stage?: LifecycleStage;
  status?: 'in-progress' | 'completed' | 'paused';
  quality_score?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Service
// ============================================================================

class ValueCaseService extends TenantAwareService {
  private realtimeChannel: RealtimeChannel | null = null;
  private listeners: Set<(cases: ValueCase[]) => void> = new Set();

  constructor() {
    super('ValueCaseService');
  }

  private async getTenantContextFromSession(): Promise<TenantContext> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      logger.error('Failed to fetch auth session for tenant validation', error);
      throw error;
    }

    const userId = data.session?.user?.id;
    if (!userId) {
      logger.warn('Tenant validation failed: no authenticated user found');
      throw new Error('Authentication required');
    }

    return this.getTenantContext(userId);
  }

  /**
   * Fetch all value cases for the current user
   */
  async getValueCases(): Promise<ValueCase[]> {
    try {
      const { userId, tenantId } = await this.getTenantContextFromSession();

      // Enforce tenant boundary even if RLS is bypassed
      const { data: valueCases, error: vcError } = await this.supabase
        .from('value_cases')
        .select(`
          id,
          name,
          description,
          status,
          quality_score,
          created_at,
          updated_at,
          metadata,
          tenant_id,
          company_profiles (
            company_name
          )
        `)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (!vcError && valueCases && valueCases.length > 0) {
        return valueCases.map((vc: any) => this.mapValueCase(vc));
      }

      // Fallback to legacy business_cases table, but still restrict to owner
      const { data: businessCases, error: bcError } = await this.supabase
        .from('business_cases')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false });

      if (bcError) {
        logger.warn('Failed to fetch business cases', { error: bcError });
        return [];
      }

      return (businessCases || []).map((bc: any) => this.mapBusinessCase(bc));
    } catch (error) {
      logger.error('Error fetching value cases', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get a single value case by ID
   */
  async getValueCase(id: string): Promise<ValueCase | null> {
    try {
      const { userId, tenantId } = await this.getTenantContextFromSession();

      const { data, error } = await this.supabase
        .from('value_cases')
        .select(`
          id,
          name,
          description,
          status,
          quality_score,
          created_at,
          updated_at,
          metadata,
          company_profiles (
            company_name
          )
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        // Try business_cases
        const { data: bc, error: bcError } = await this.supabase
          .from('business_cases')
          .select('*')
          .eq('id', id)
          .eq('owner_id', userId)
          .single();

        if (bcError || !bc) return null;
        return this.mapBusinessCase(bc);
      }

      return this.mapValueCase(data);
    } catch (error) {
      logger.error('Error fetching value case', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Create a new value case
   */
  async createValueCase(input: ValueCaseCreate): Promise<ValueCase | null> {
    try {
      const { userId, tenantId } = await this.getTenantContextFromSession();

      // Ensure user is allowed to create within this tenant
      await this.validateTenantAccess(userId, tenantId);

      // Create in business_cases table (simpler, always works)
      const { data, error } = await this.supabase
        .from('business_cases')
        .insert({
          name: input.name,
          client: input.company,
          status: 'draft',
          owner_id: userId,
          metadata: {
            ...input.metadata,
            stage: input.stage || 'opportunity',
            description: input.description,
            tenant_id: tenantId,
          },
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create value case', error);
        return null;
      }

      return this.mapBusinessCase(data);
    } catch (error) {
      logger.error('Error creating value case', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Update a value case
   */
  async updateValueCase(id: string, update: ValueCaseUpdate): Promise<ValueCase | null> {
    try {
      const { userId, tenantId } = await this.getTenantContextFromSession();

      // Try updating in business_cases first
      const { data, error } = await this.supabase
        .from('business_cases')
        .update({
          name: update.name,
          client: update.company,
          status: update.status === 'completed' ? 'presented' : 'draft',
          metadata: {
            stage: update.stage,
            description: update.description,
            quality_score: update.quality_score,
            ...update.metadata,
            tenant_id: tenantId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('owner_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update value case', error);
        return null;
      }

      return this.mapBusinessCase(data);
    } catch (error) {
      logger.error('Error updating value case', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Delete a value case
   */
  async deleteValueCase(id: string): Promise<boolean> {
    try {
      const { userId } = await this.getTenantContextFromSession();

      const { error } = await this.supabase
        .from('business_cases')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) {
        logger.error('Failed to delete value case', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error deleting value case', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(callback: (cases: ValueCase[]) => void): () => void {
    this.listeners.add(callback);

    // Set up realtime subscription if not already done
    if (!this.realtimeChannel) {
      this.initializeRealtimeChannel();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    };
  }

  private async initializeRealtimeChannel(): Promise<void> {
    try {
      const { userId } = await this.getTenantContextFromSession();

      this.realtimeChannel = this.supabase
        .channel('value-cases-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'business_cases',
            filter: `owner_id=eq.${userId}`
          },
          async () => {
            const cases = await this.getValueCases();
            this.notifyListeners(cases);
          }
        )
        .subscribe();
    } catch (error) {
      logger.error('Failed to initialize tenant-scoped realtime channel', error as Error);
    }
  }

  private notifyListeners(cases: ValueCase[]): void {
    this.listeners.forEach(callback => callback(cases));
  }

  // ============================================================================
  // Mappers
  // ============================================================================

  private mapValueCase(data: any): ValueCase {
    const metadata = data.metadata || {};
    const stage = metadata.stage || 'opportunity';
    const status = data.status === 'published' ? 'completed' : 'in-progress';

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      company: data.company_profiles?.[0]?.company_name || 'Unknown Company',
      stage: this.normalizeStage(stage),
      status,
      quality_score: data.quality_score,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      metadata,
    };
  }

  private mapBusinessCase(data: any): ValueCase {
    const metadata = data.metadata || {};
    const stage = metadata.stage || 'opportunity';
    const status = data.status === 'presented' ? 'completed' : 'in-progress';

    return {
      id: data.id,
      name: data.name,
      description: metadata.description,
      company: data.client,
      stage: this.normalizeStage(stage),
      status,
      quality_score: metadata.quality_score,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      metadata,
    };
  }

  private normalizeStage(stage: string): LifecycleStage {
    const validStages: LifecycleStage[] = ['opportunity', 'target', 'realization', 'expansion'];
    if (validStages.includes(stage as LifecycleStage)) {
      return stage as LifecycleStage;
    }
    return 'opportunity';
  }
}

// Export singleton instance
export const valueCaseService = new ValueCaseService();
