import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { validateRequest } from '../inputValidation';

describe('inputValidation middleware', () => {
  it('accepts valid payloads and sanitizes input', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/demo',
      validateRequest({
        name: { type: 'string', required: true, minLength: 2 },
      }),
      (req, res) => {
        res.status(200).json({ ok: true, payload: req.body });
      }
    );

    const response = await request(app)
      .post('/demo')
      .send({ name: 'Alice' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      payload: { name: 'Alice' },
    });
  });

  it('rejects unknown fields', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/demo',
      validateRequest({
        name: { type: 'string', required: true, minLength: 2 },
      }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    const response = await request(app)
      .post('/demo')
      .send({ name: 'Alice', extra: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toContain('Unknown field: extra');
  });
});
