import { ValueCommit } from '../dto';
import { ValueCommitSchema } from '../schemas/valueCommit.schema';

export function fromValueCase(row: any): ValueCommit {
  const commit: ValueCommit = {
    valueCaseId: row.id,
    state: row.state,
    committedAt: row.committed_at ?? undefined,
    actor: row.last_modified_by ?? '',
  };
  ValueCommitSchema.parse(commit);
  return commit;
}
