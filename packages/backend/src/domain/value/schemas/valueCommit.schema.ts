import { z } from 'zod';
import { ValueCommitDTO } from '../dto';

// Invariant: allowed transitions only
export const ValueCommitSchema = ValueCommitDTO.superRefine((commit, ctx) => {
  // Allowed transitions are enforced at the service layer, but schema can check state
  const allowedStates = ['draft', 'active', 'committed', 'archived'];
  if (!allowedStates.includes(commit.state)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid state: ${commit.state}`,
      path: ['state'],
    });
  }
});
