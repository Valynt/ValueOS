import type { SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { ConsentRegistry } from '../../types/consent';
import { requireConsent } from '../consentMiddleware.js';

describe('requireConsent', () => {
  it('blocks requests when consent is denied', async () => {
    const registry: ConsentRegistry = {
      hasConsent: vi.fn().mockResolvedValue(false),
    };

    const app = express();
    app.use((req, _res, next) => {
      req.tenantId = 'tenant-123';
      req.user = { id: 'user-123', sub: 'subject-123' };
      req.supabase = { from: vi.fn() } as unknown as SupabaseClient;
      next();
    });
    app.get('/protected', requireConsent('llm.chat', registry), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
    expect(registry.hasConsent).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      subject: 'subject-123',
      scope: 'llm.chat',
      supabase: expect.objectContaining({ from: expect.any(Function) }),
    });
  });

  it('returns 400 when the authenticated subject context is missing', async () => {
    const registry: ConsentRegistry = {
      hasConsent: vi.fn().mockResolvedValue(true),
    };

    const app = express();
    app.use((req, _res, next) => {
      req.tenantId = 'tenant-123';
      req.user = { id: 'user-123' };
      next();
    });
    app.get('/protected', requireConsent('llm.chat', registry), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(400);
    expect(registry.hasConsent).not.toHaveBeenCalled();
  });
});
