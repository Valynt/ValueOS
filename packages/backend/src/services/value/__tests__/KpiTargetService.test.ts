import { KpiTargetService } from '../KpiTargetService';

describe('KpiTargetService', () => {
  const supabase = {} as any;
  it('should construct', () => {
    const svc = new KpiTargetService(supabase);
    expect(svc).toBeTruthy();
  });
});
