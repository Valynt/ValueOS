import { z } from 'zod';
import { RoiModelDTO } from '../dto';

// Invariant: required assumptions present, numeric sanity checks
export const RoiModelSchema = RoiModelDTO.superRefine((model, ctx) => {
  // All assumptions and outputs must be finite numbers
  for (const [k, v] of Object.entries(model.assumptions)) {
    if (!Number.isFinite(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Assumption ${k} is not a finite number`,
        path: ['assumptions', k],
      });
    }
  }
  for (const [k, v] of Object.entries(model.outputs)) {
    if (!Number.isFinite(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Output ${k} is not a finite number`,
        path: ['outputs', k],
      });
    }
  }
});
