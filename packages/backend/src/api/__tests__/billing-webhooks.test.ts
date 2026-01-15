/**
 * Billing Webhooks API Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import webhookRouter from '../billing/webhooks';
import { __getEnvSourceForTests, __setEnvSourceForTests } from '@shared/lib/env';

describe('Billing Webhooks API', () => {
  const originalEnv = __getEnvSourceForTests();
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/billing/webhooks', webhookRouter);
  });

  afterEach(() => {
    __setEnvSourceForTests(originalEnv);
  });

  it('should return 503 when billing DB config is missing', async () => {
    __setEnvSourceForTests({});

    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}));

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Billing database configuration is missing');
  });
});
