import { getRealtimeBroadcastService } from '../RealtimeBroadcastService';

describe('RealtimeBroadcastService', () => {
  it('sends messages only to matching tenant clients', () => {
    // Arrange: create fake wss with clients
    const fakeClientA: any = { readyState: 1, tenantId: 'tenant-a', sent: [], send(msg: string) { this.sent.push(msg); } };
    const fakeClientB: any = { readyState: 1, tenantId: 'tenant-b', sent: [], send(msg: string) { this.sent.push(msg); } };

    // Monkeypatch global server wss
    const wssModule = require('../../server');
    const originalClients = (wssModule.wss as any).clients;
    (wssModule.wss as any).clients = new Set([fakeClientA, fakeClientB]);

    try {
      const svc = getRealtimeBroadcastService();
      svc.broadcastToTenant('tenant-a', 'agent.reasoning.update', { foo: 'bar' });

      expect(fakeClientA.sent.length).toBeGreaterThan(0);
      expect(fakeClientB.sent.length).toBe(0);
    } finally {
      // restore
      (wssModule.wss as any).clients = originalClients;
    }
  });
});
