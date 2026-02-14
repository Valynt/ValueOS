import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../server';

function extractCsrfToken(setCookieHeader: string[] | undefined): string {
  const cookieEntry = setCookieHeader?.find((entry) => entry.startsWith('csrf_token='));
  if (!cookieEntry) {
    throw new Error('Missing csrf_token cookie in response');
  }

  return cookieEntry.split(';')[0].split('=')[1] ?? '';
}

describe('CSRF routing policy', () => {
  it('rejects state-changing cookie/session route when CSRF token is missing', async () => {
    const response = await request(app).post('/api/auth/login').send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'CSRF validation failed' });
  });

  it('rejects state-changing cookie/session route when CSRF token mismatches cookie', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', 'header-token')
      .set('Cookie', 'csrf_token=cookie-token')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'CSRF validation failed' });
  });

  it('accepts valid double-submit CSRF token on state-changing cookie/session route', async () => {
    const safeResponse = await request(app).get('/api/does-not-exist');
    const csrfToken = extractCsrfToken(safeResponse.headers['set-cookie']);

    const response = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `csrf_token=${csrfToken}`)
      .send({});

    expect(response.status).not.toBe(403);
  });
});
