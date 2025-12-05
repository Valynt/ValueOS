/**
 * Value Case Service
 * 
 * Manages value cases for the Chat + Canvas UI.
 * Fetches from Supabase and provides real-time updates.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import type { LifecycleStage } from '../types/vos';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

class ValueCaseService {
  private realtimeChannel: RealtimeChannel | null = null;
  private listeners: Set<(cases: ValueCase[]) => void> = new Set();

  /**
   * Fetch all value cases for the current user
   */
  async getValueCases(): Promise<ValueCase[]> {
    try {
      // First try to get from value_cases table (agent fabric)
      const { data: valueCases, error: vcError } = await (supabase as any)
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
        .order('updated_at', { ascending: false });

      if (!vcError && valueCases && valueCases.length > 0) {
        return valueCases.map((vc: any) => this.mapValueCase(vc));
      }

      // Fallback to business_cases table
      const { data: businessCases, error: bcError } = await (supabase as any)
        .from('business_cases')
        .select('*')
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
      const { data, error } = await (supabase as any)
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
        .single();

      if (error || !data) {
        // Try business_cases
        const { data: bc, error: bcError } = await (supabase as any)
          .from('business_cases')
          .select('*')
          .eq('id', id)
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
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        logger.warn('No authenticated user for creating value case');
        // For demo, still create in business_cases
      }

      // Create in business_cases table (simpler, always works)
      const { data, error } = await (supabase as any)
        .from('business_cases')
        .insert({
          name: input.name,
          client: input.company,
          status: 'draft',
          owner_id: userId || '00000000-0000-0000-0000-000000000000',
          metadata: {
            ...input.metadata,
            stage: input.stage || 'opportunity',
            description: input.description,
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
      // Try updating in business_cases first
      const { data, error } = await (supabase as any)
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
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
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
      const { error } = await (supabase as any)
        .from('business_cases')
        .delete()
        .eq('id', id);

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
      this.realtimeChannel = supabase
        .channel('value-cases-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'business_cases' },
          async () => {
            const cases = await this.getValueCases();
            this.notifyListeners(cases);
          }
        )
        .subscribe();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    };
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
