import { RoiModelService } from '../RoiModelService';

describe('RoiModelService', () => {
  const supabase = {} as any;
  it('should construct', () => {
    const svc = new RoiModelService(supabase);
    expect(svc).toBeTruthy();
  });
});
