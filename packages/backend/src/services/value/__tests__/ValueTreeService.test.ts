import { ValueTreeService } from '../ValueTreeService';

describe('ValueTreeService', () => {
  const supabase = {} as any;
  it('should construct', () => {
    const svc = new ValueTreeService(supabase);
    expect(svc).toBeTruthy();
  });
});
