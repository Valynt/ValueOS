import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis-backed cache so tests are hermetic and fast.
vi.mock('../../services/ReadThroughCacheService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ReadThroughCacheService.js')>();
  return {
    ...actual,
    ReadThroughCacheService: {
      getOrLoad: vi.fn((_config: unknown, loader: () => Promise<unknown>) => loader()),
      invalidateEndpoint: vi.fn().mockResolvedValue(0),
    },
  };
});

import { projectsRouter } from '../projects.js';

const authHeader = { Authorization: 'Bearer test-token' };

function buildApp(role: string | undefined, appMetadataRole?: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.tenantId = 'tenant-test';
    req.user = {
      id: 'user-1',
      ...(role !== undefined ? { role } : {}),
      ...(appMetadataRole !== undefined
        ? { app_metadata: { role: appMetadataRole } }
        : {}),
    };
    next();
  });
  app.use('/api/projects', projectsRouter);
  return app;
}

describe('Projects API — role from JWT claims, not headers', () => {
  let adminApp: express.Express;

  beforeEach(async () => {
    adminApp = buildApp('admin');
    // Seed one project as admin for mutation tests.
    await request(adminApp)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'Seed Project' });
  });

  describe('write operations require editor or admin role in claims', () => {
    it('allows POST when req.user.role is "editor"', async () => {
      const app = buildApp('editor');
      await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'Editor Project' })
        .expect(201);
    });

    it('allows POST when role is in req.user.app_metadata.role', async () => {
      const app = buildApp(undefined, 'admin');
      await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'AppMeta Admin Project' })
        .expect(201);
    });

    it('rejects POST when req.user.role is "viewer"', async () => {
      const app = buildApp('viewer');
      await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'Viewer Project' })
        .expect(403);
    });

    it('rejects POST when req.user has no role at all', async () => {
      const app = buildApp(undefined);
      await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'No Role Project' })
        .expect(403);
    });
  });

  describe('x-user-role header is ignored', () => {
    it('does not grant write access via x-user-role header when claims role is insufficient', async () => {
      const app = buildApp('viewer');
      // Attacker supplies a privileged role via header — must be ignored.
      await request(app)
        .post('/api/projects')
        .set(authHeader)
        .set('x-user-role', 'admin')
        .send({ name: 'Spoofed Role Project' })
        .expect(403);
    });

    it('does not grant delete access via x-user-role header when claims role is "editor"', async () => {
      // Create a project as admin first.
      const createRes = await request(adminApp)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'Delete Target' })
        .expect(201);

      const projectId: string = createRes.body.data.id;

      // Editor cannot delete (requires "admin" in claims).
      const editorApp = buildApp('editor');
      await request(editorApp)
        .delete(`/api/projects/${projectId}`)
        .set(authHeader)
        .set('x-user-role', 'admin') // header spoof — must be ignored
        .expect(403);
    });
  });

  describe('x-user-id header is ignored for owner derivation', () => {
    it('sets ownerId from req.user.id, not x-user-id header', async () => {
      const app = buildApp('admin');
      const res = await request(app)
        .post('/api/projects')
        .set(authHeader)
        .set('x-user-id', 'attacker-id')
        .send({ name: 'Owner Check Project' })
        .expect(201);

      // ownerId must be the authenticated user's ID from claims, not the header.
      expect(res.body.data.ownerId).toBe('user-1');
    });
  });

  describe('DELETE requires admin role in claims', () => {
    it('allows DELETE when req.user.role is "admin"', async () => {
      const createRes = await request(adminApp)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'Admin Delete' })
        .expect(201);

      await request(adminApp)
        .delete(`/api/projects/${createRes.body.data.id}`)
        .set(authHeader)
        .expect(204);
    });

    it('rejects DELETE when req.user.role is "editor"', async () => {
      const createRes = await request(adminApp)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'Editor Cannot Delete' })
        .expect(201);

      const editorApp = buildApp('editor');
      await request(editorApp)
        .delete(`/api/projects/${createRes.body.data.id}`)
        .set(authHeader)
        .expect(403);
    });
  });
});
