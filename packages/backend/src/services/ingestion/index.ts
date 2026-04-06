/**
 * @valueos/backend/services/ingestion
 *
 * Ingestion layer — normalizes inputs from documents, web scrapes, and CRM
 * records into a unified NormalizedContext for agent consumption.
 */
export {
  ContextNormalizationPipeline,
  createContextPipeline,
  NormalizedContextSchema,
  NormalizedStakeholderSchema,
  DEFAULT_MAX_FILE_BYTES,
} from './ContextNormalizationPipeline.js';

export type {
  NormalizedContext,
  NormalizedStakeholder,
  ContextSource,
  ContextSourceType,
} from './ContextNormalizationPipeline.js';
