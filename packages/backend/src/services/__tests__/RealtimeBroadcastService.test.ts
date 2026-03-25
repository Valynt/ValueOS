import { getRealtimeBroadcastService } from '../RealtimeBroadcastService';

vi.mock("../../lib/supabase.js");

const mockBroadcast = vi.fn();
vi.mock('../realtime/WebSocketBroadcastAdapter.js', () => ({
  getBroadcastAdapter: () => ({ broadcast: mockBroadcast }),
}));

describe('RealtimeBroadcastService', () => {
  it('sends messages only to matching tenant clients', () => {
    const svc = getRealtimeBroadcastService();
    svc.broadcastToTenant('tenant-a', 'agent.reasoning.update', { foo: 'bar' });

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    const [calledTenantId, message] = mockBroadcast.mock.calls[0] ?? [];
    expect(calledTenantId).toBe('tenant-a');
    const parsed = JSON.parse(message as string);
    expect(parsed.type).toBe('agent.reasoning.update');
    expect(parsed.payload).toEqual({ foo: 'bar' });
  });
});
