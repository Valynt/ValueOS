import { ValueCommitmentRow } from '../db/rows';
import { ValueCommit } from '../dto';
import { ValueCommitSchema } from '../schemas/valueCommit.schema';

export function fromValueCommitments(rows: ValueCommitmentRow[]): ValueCommit[] {
  return rows.map(row => {
    const commit: ValueCommit = {
      id: row.id,
      predicted_value: row.financial_impact?.predicted_value ?? 0,
      agent_type: 'realization', // Assuming default
      value_tree_id: undefined, // Not in table
      created_at: row.created_at,
    };
    ValueCommitSchema.parse(commit);
    return commit;
  });
}
