import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing the router
vi.mock('../../../services/CanvasSchemaService', () => ({
  canvasSchemaService: {
    generateSchema: vi.fn()
  }
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn((msg, meta) => console.error('MOCKED LOGGER ERROR:', msg, meta)),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import dependencies
import { canvasSchemaService } from '../../services/sdui/CanvasSchemaService.js'
import sduiRouter from '../sdui.js'

import { SDUI_VERSION } from '@valueos/sdui';

vi.mock("../../lib/supabase.js");

// Create Express app for testing
const app = express();
app.use(express.json());
// Middleware to mock authentication/tenant context
app.use((req, res, next) => {
  (req as any).user = { id: 'test-user' };
  (req as any).tenantId = 'test-tenant';
  next();
});
app.use(sduiRouter);

describe('SDUI Routes', () => {
  const mockSchema = {
    type: 'page',
    version: SDUI_VERSION,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Test Banner'
        }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sdui/schema/:workspaceId', () => {
    it('should return schema for valid workspace', async () => {
      vi.mocked(canvasSchemaService.generateSchema).mockResolvedValue(mockSchema as any);

      const response = await request(app)
        .get('/api/sdui/schema/workspace-123')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        type: 'page',
        version: SDUI_VERSION
      });
      expect(response.headers['sdui-version']).toBe(String(SDUI_VERSION));
      expect(canvasSchemaService.generateSchema).toHaveBeenCalledWith(
        'workspace-123',
        expect.objectContaining({
          userId: 'test-user',
          workspaceId: 'workspace-123',
          metadata: expect.objectContaining({ tenantId: 'test-tenant' })
        })
      );
    });

    it('should handle version negotiation (downgrade)', async () => {
      const v1Schema = {
        ...mockSchema,
        version: 1
      };

      vi.mocked(canvasSchemaService.generateSchema).mockResolvedValue(mockSchema as any);

      const response = await request(app)
        .get('/api/sdui/schema/workspace-123')
        .set('Accept-Version', 'v1')
        .expect(200);

      expect(response.body.version).toBe(1);
      expect(response.headers['warning']).toBeDefined();
    });

    it('should handle invalid schema generation', async () => {
      vi.mocked(canvasSchemaService.generateSchema).mockResolvedValue({ invalid: 'schema' } as any);

      await request(app)
        .get('/api/sdui/schema/workspace-123')
        .expect(500);
    });

    it('should handle service errors', async () => {
      vi.mocked(canvasSchemaService.generateSchema).mockRejectedValue(new Error('Service failure'));

      await request(app)
        .get('/api/sdui/schema/workspace-123')
        .expect(500);
    });
  });

  describe('GET /api/sdui/versions', () => {
    it('should return supported versions', async () => {
      const response = await request(app)
        .get('/api/sdui/versions')
        .expect(200);

      expect(response.body).toHaveProperty('current', SDUI_VERSION);
      expect(response.body).toHaveProperty('supported');
    });
  });

  describe('GET /api/sdui/agent/:agentId/schema', () => {
    it('should return agent schema', async () => {
      const response = await request(app)
        .get('/api/sdui/agent/agent-123/schema')
        .expect(200);

      expect(response.body).toHaveProperty('type', 'page');
      expect(response.body.sections[0]).toHaveProperty('component', 'AgentWorkflowPanel');
    });
  });

  describe('POST /api/sdui/validate', () => {
    it('should validate correct schema', async () => {
      await request(app)
        .post('/api/sdui/validate')
        .send(mockSchema)
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
        });
    });

    it('should reject invalid schema', async () => {
      await request(app)
        .post('/api/sdui/validate')
        .send({ type: 'invalid' })
        .expect(400)
        .expect((res) => {
          expect(res.body.valid).toBe(false);
        });
    });
  });
});
