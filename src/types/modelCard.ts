import { z } from 'zod';

export const ModelCardSchema = z.object({
  model_version: z.string(),
  safety_constraints: z.array(z.string()),
  known_limitations: z.array(z.string()),
  training_cutoff: z.string(),
  prompt_contract_hash: z.string(),
});

export type ModelCard = z.infer<typeof ModelCardSchema>;

export const MODEL_CARD_SCHEMA_VERSION = '1.0.0';
