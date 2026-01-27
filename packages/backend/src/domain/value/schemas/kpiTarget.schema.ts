import { z } from 'zod';
import { KpiTargetDTO } from '../dto';

// Invariant: units/timeframe present, baseline/target consistent
export const KpiTargetSchema = KpiTargetDTO.superRefine((kpi, ctx) => {
  if (!kpi.unit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Unit is required',
      path: ['unit'],
    });
  }
  if (!kpi.timeframe) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Timeframe is required',
      path: ['timeframe'],
    });
  }
  if (!Number.isFinite(kpi.targetValue)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target value must be a finite number',
      path: ['targetValue'],
    });
  }
});
