import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

export class AssumptionService {
  /**
   * Update an assumption
   */
  async updateAssumption(
    assumptionId: string,
    updates: Record<string, unknown>
  ): Promise<{ assumptionId: string; updated: boolean; data: unknown }> {
    logger.info('Updating assumption', { assumptionId });

    // Ensure we are not trying to update immutable fields or ID
    const { id, ...safeUpdates } = updates;

    const { data, error } = await supabase
      .from('assumptions')
      .update(safeUpdates)
      .eq('id', assumptionId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update assumption', { assumptionId, error });
      throw new Error(`Failed to update assumption: ${error.message}`);
    }

    return {
      assumptionId,
      updated: true,
      data
    };
  }

  /**
   * Get an assumption by ID
   */
  async getAssumption(assumptionId: string): Promise<unknown> {
    const { data, error } = await supabase
      .from('assumptions')
      .select('*')
      .eq('id', assumptionId)
      .single();

    if (error) {
        logger.error('Failed to fetch assumption', { assumptionId, error });
        throw new Error(`Failed to fetch assumption: ${error.message}`);
    }

    return data;
  }
}

export const assumptionService = new AssumptionService();
