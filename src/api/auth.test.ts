import express from 'express';
import request from 'supertest';
import router from './auth';

describe('auth api router', () => {
  const app = express().use('/api/auth', router);

  it('returns not implemented for login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a', password: 'b' });
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/not implemented/i);
  });

  it('returns not implemented for password reset', async () => {
    const res = await request(app).post('/api/auth/password/reset').send({ email: 'test@example.com' });
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/not implemented/i);
  });
});
