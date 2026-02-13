/**
 * Environment Configuration
 * 
 * Re-exports environment utilities from shared package
 */

export {
  getEnvVar,
  setEnvVar,
  getSupabaseConfig,
  getGroundtruthConfig,
  getLLMCostTrackerConfig,
  __setEnvSourceForTests
} from '@shared/lib/env';
