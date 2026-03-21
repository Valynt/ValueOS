import { EVENT_TOPICS } from '@shared/types/events';
import express from 'express';
import request from 'supertest';

import agentsRouter from '../../api/agents';
import { getEventProducer } from '../../services/EventProducer';

vi.mock("../../lib/supabase.js");


vi.mock('../../services/EventProducer');

describe('POST /api/agents/execute', () => {
  let app: express.Express;
  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Inject simple auth/tenant middleware for test
    app.use((req: any, _res, next) => {
      req.user = { id: 'test-user' };
      req.tenantId = 'test-tenant';
      next();
    });

    app.use('/api/agents', agentsRouter);
  });

  it('publishes an agent request event for typed execute', async () => {
    const fakeProducer = { publish: vi.fn() };
    (getEventProducer as unknown as vi.Mock).mockReturnValue(fakeProducer);

    const res = await request(app)
      .post('/api/agents/execute')
      .send({ type: 'IntegrityAgent:resolveIssue', data: { issueId: 'issue-1', resolution: 'accept' } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
    expect(fakeProducer.publish).toHaveBeenCalled();
    const [[topic, event]] = fakeProducer.publish.mock.calls;
    expect(topic).toBe(EVENT_TOPICS.AGENT_REQUESTS);
    expect(event.payload.agentId).toBe('IntegrityAgent');
    expect(event.payload.parameters).toBeDefined();
  });
});
