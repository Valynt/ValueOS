import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

process.env.NODE_ENV = 'test';
const jwtSecret = 'test-websocket-secret';
process.env.JWT_SECRET = jwtSecret;

let server: any;
let wss: any;
let port: number;

const createToken = (userId: string, tenantId: string) =>
  jwt.sign({ sub: userId, tenant_id: tenantId, email: `${userId}@example.com`, role: 'authenticated' }, jwtSecret, { expiresIn: '1h' });

beforeAll(async () => {
  const serverModule = await import('../../server');
  server = serverModule.server;
  wss = serverModule.wss;

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
      port = address.port;
      resolve();
    });
  });
});

afterAll(async () => {
  wss.clients.forEach((c: any) => c.close());
  await new Promise<void>((r) => wss.close(() => r()));
  await new Promise<void>((r) => server.close(() => r()));
});

describe('Integration: /api/agents/execute -> realtime broadcast', () => {
  it('sends integrity.issue.resolved to websocket subscribers', async () => {
    // Mock unified agent API to return resolution immediately
    vi.mock('../../services/UnifiedAgentAPI', () => ({
      getUnifiedAgentAPI: () => ({
        invoke: vi.fn().mockResolvedValue({
          data: { resolvedIssueId: 'issue-xyz', resolution: 'accept' },
          metadata: { tokens: {}, confidence: 0.9 },
        }),
      }),
    }));

    // Make publish call route to AgentExecutorService in-process
    const mockProducer = {
      publish: async (_topic: string, event: any) => {
        const { getAgentExecutorService } = await import('../../services/AgentExecutorService');
        await (getAgentExecutorService() as any).handleAgentRequest(event);
      },
    };

    vi.mock('../../services/EventProducer', () => ({ getEventProducer: () => mockProducer }));

    const token = createToken('user-1', 'tenant-1');
    const ws = new WebSocket(`ws://localhost:${port}/ws/sdui`, { headers: { authorization: `Bearer ${token}` } });

    // Await open
    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    const received: any[] = [];
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        received.push(parsed);
      } catch (err) {
        // ignore
      }
    });

    // Invoke the typed execute endpoint
    const res = await request(server)
      .post('/api/agents/execute')
      .set('authorization', `Bearer ${token}`)
      .send({ type: 'IntegrityAgent:resolveIssue', data: { issueId: 'issue-xyz', resolution: 'accept' } })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Wait for broadcast to arrive
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for broadcast')), 2000);
      const check = () => {
        const m = received.find((r) => r && r.type === 'agent.event' && r.payload?.eventType === 'integrity.issue.resolved');
        if (m) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    const found = received.find((r) => r && r.type === 'agent.event' && r.payload?.eventType === 'integrity.issue.resolved');
    expect(found).toBeDefined();
    expect(found.payload.data.issueId).toBe('issue-xyz');

    ws.close();
  });
});
