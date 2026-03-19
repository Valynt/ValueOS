import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { ConsentRegistry } from '../../types/consent';
import {
  getCanonicalSubjectFromRequest,
  requireConsent,
} from '../consentMiddleware.js';

describe('requireConsent', () => {
  it('blocks requests when consent is denied', async () => {
    const registry: ConsentRegistry = {
      hasConsent: vi.fn().mockResolvedValue(false),
    };

    const app = express();
    app.use((req, _res, next) => {
      req.tenantId = 'tenant-123';
      req.user = { id: 'user-a', sub: 'subject-a' };
      req.headers.authorization = 'Bearer test-token';
      next();
    });
    app.get(
      '/protected',
      requireConsent('llm.chat', registry, getCanonicalSubjectFromRequest),
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    const response = await request(app).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
    expect(registry.hasConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-123',
        scope: 'llm.chat',
        subject: 'subject-a',
      })
    );
  });

  it('rejects requests without an authenticated subject identifier', async () => {
    const registry: ConsentRegistry = {
      hasConsent: vi.fn(),
    };

    const app = express();
    app.use((req, _res, next) => {
      req.tenantId = 'tenant-123';
      req.headers.authorization = 'Bearer test-token';
      next();
    });
    app.get(
      '/protected',
      requireConsent('llm.chat', registry, getCanonicalSubjectFromRequest),
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(registry.hasConsent).not.toHaveBeenCalled();
  });
});
