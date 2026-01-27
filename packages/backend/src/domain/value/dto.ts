// Value Domain DTOs (Zod + Types)
import { z } from 'zod';

export const ValueTreeNodeDTO = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  label: z.string(),
  driverType: z.string(),
  value: z.number().nullable(),
});

export const ValueTreeDTO = z.object({
  valueCaseId: z.string(),
  nodes: z.array(ValueTreeNodeDTO),
});

export const RoiModelDTO = z.object({
  valueCaseId: z.string(),
  assumptions: z.record(z.string(), z.number()),
  outputs: z.record(z.string(), z.number()),
});

export const ValueCommitDTO = z.object({
  valueCaseId: z.string(),
  state: z.enum(['draft', 'active', 'committed', 'archived']),
  committedAt: z.string().datetime().optional(),
  actor: z.string(),
});

export const KpiTargetDTO = z.object({
  metric: z.string(),
  targetValue: z.number(),
  unit: z.string(),
  timeframe: z.string(),
  basis: z.string(), // explanation of derivation
});

export type ValueTree = z.infer<typeof ValueTreeDTO>;
export type ValueTreeNode = z.infer<typeof ValueTreeNodeDTO>;
export type RoiModel = z.infer<typeof RoiModelDTO>;
export type ValueCommit = z.infer<typeof ValueCommitDTO>;
export type KpiTarget = z.infer<typeof KpiTargetDTO>;
