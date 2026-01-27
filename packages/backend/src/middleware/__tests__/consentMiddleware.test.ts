import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireConsent } from '../consentMiddleware.js'
import type { ConsentRegistry } from '../../types/consent';

describe('requireConsent', () => {
  it('blocks requests when consent is denied', async () => {
    const registry: ConsentRegistry = {
      hasConsent: vi.fn().mockResolvedValue(false),
    };

    const app = express();
    app.use((req, _res, next) => {
      (req as any).tenantId = 'tenant-123';
      next();
    });
    app.get('/protected', requireConsent('llm.chat', registry), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });
});
