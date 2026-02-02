/**
 * Environment Configuration
 * 
 * Re-exports environment utilities from shared package
 */

export {
  getEnvVar,
  setEnvVar,
  getSupabaseConfig,
  getLLMCostTrackerConfig,
  __setEnvSourceForTests
} from '@shared/lib/env';
