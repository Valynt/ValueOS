/**
 * Zod schemas for validating 'model' related API inputs.
 */
import { z } from 'zod';

export const CreateModelSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
  description: z.string().optional(),
  model_data: z.record(z.any()).refine(data => Object.keys(data).length > 0, {
    message: "Model data cannot be empty",
  }),
});

export const UpdateModelSchema = CreateModelSchema.partial();
