import { ValueCommitService } from '../ValueCommitService';

describe('ValueCommitService', () => {
  const supabase = {} as any;
  it('should construct', () => {
    const svc = new ValueCommitService(supabase);
    expect(svc).toBeTruthy();
  });
});
