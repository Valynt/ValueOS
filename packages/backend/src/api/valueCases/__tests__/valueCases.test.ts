import { vi } from "vitest";
/**
 * Value Cases API Tests
 * 
 * Tests for: happy path, validation failure, auth failure, dependency failure
 */

import request from 'supertest';
import express, { Express } from 'express';
import { valueCasesRouter } from '../index.js'
import { getValueCasesRepository, NotFoundError, DatabaseError } from '../repository.js'

// Mock the repository
vi.mock('../repository');

// Mock auth middleware
vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@example.com', roles: ['admin', 'member'] };
    req.tenantId = 'tenant-123';
    req.correlationId = 'test-correlation-id';
    next();
  }),
  requireRole: vi.fn((roles: string[]) => (req: any, res: any, next: any) => {
    const userRoles = req.user?.roles || [];
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    next();
  }),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: any, _res: any, next: any) => {
    req.tenantId = req.tenantId || 'tenant-123';
    next();
  },
}));

// Mock rate limiter
vi.mock('../../../middleware/rateLimiter', () => ({
  createRateLimiter: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

// Mock logger
vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Value Cases API', () => {
  let app: Express;
  let mockRepository: jest.Mocked<ReturnType<typeof getValueCasesRepository>>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/cases', valueCasesRouter);

    mockRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as any;

    (getValueCasesRepository as jest.Mock).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Happy Path Tests
  // =========================================================================

  describe('POST /api/v1/cases - Create', () => {
    it('should create a value case successfully', async () => {
      const createData = {
        name: 'Test Case',
        companyName: 'Acme Corp',
        description: 'Test description',
      };

      const createdCase = {
        id: 'case-123',
        tenantId: 'tenant-123',
        ...createData,
        status: 'draft',
        phase: 'discovery',
        stakeholders: [],
        metrics: [],
        valueDrivers: [],
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(createdCase);

      const response = await request(app)
        .post('/api/v1/cases')
        .send(createData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: 'case-123',
        name: 'Test Case',
        companyName: 'Acme Corp',
      });
      expect(mockRepository.create).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
        createData
      );
    });
  });

  describe('GET /api/v1/cases - List', () => {
    it('should list value cases with pagination', async () => {
      const cases = [
        { id: 'case-1', name: 'Case 1', companyName: 'Company 1' },
        { id: 'case-2', name: 'Case 2', companyName: 'Company 2' },
      ];

      mockRepository.list.mockResolvedValue({
        data: cases as any,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasMore: false,
        },
      });

      const response = await request(app)
        .get('/api/v1/cases')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });
  });

  describe('GET /api/v1/cases/:caseId - Get One', () => {
    it('should return a single value case', async () => {
      const valueCase = {
        id: 'case-123',
        name: 'Test Case',
        companyName: 'Acme Corp',
      };

      mockRepository.getById.mockResolvedValue(valueCase as any);

      const response = await request(app)
        .get('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.data.id).toBe('case-123');
    });
  });

  describe('PATCH /api/v1/cases/:caseId - Update', () => {
    it('should update a value case', async () => {
      const updatedCase = {
        id: 'case-123',
        name: 'Updated Name',
        companyName: 'Acme Corp',
      };

      mockRepository.update.mockResolvedValue(updatedCase as any);

      const response = await request(app)
        .patch('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/v1/cases/:caseId - Delete', () => {
    it('should delete a value case', async () => {
      mockRepository.delete.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000')
        .expect(204);

      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Validation Failure Tests
  // =========================================================================

  describe('Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/cases')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toBeDefined();
    });

    it('should return 400 for name exceeding max length', async () => {
      const response = await request(app)
        .post('/api/v1/cases')
        .send({
          name: 'a'.repeat(201),
          companyName: 'Acme Corp',
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid UUID in path', async () => {
      const response = await request(app)
        .get('/api/v1/cases/invalid-uuid')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('UUID');
    });

    it('should reject unknown fields in request body', async () => {
      const response = await request(app)
        .post('/api/v1/cases')
        .send({
          name: 'Test Case',
          companyName: 'Acme Corp',
          unknownField: 'should be rejected',
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // Auth Failure Tests
  // =========================================================================

  describe('Authentication Errors', () => {
    it('should return 403 for insufficient permissions', async () => {
      // Override the mock for this test
      const { requireRole } = require('../../../middleware/auth');
      (requireRole as jest.Mock).mockImplementationOnce(() => (_req: any, res: any) => {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
        });
      });

      // Re-create app with new mock
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/v1/cases', valueCasesRouter);

      const response = await request(testApp)
        .delete('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000')
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Dependency Failure Tests
  // =========================================================================

  describe('Dependency Errors', () => {
    it('should return 404 when case not found', async () => {
      mockRepository.getById.mockRejectedValue(
        new NotFoundError('ValueCase', 'case-123')
      );

      const response = await request(app)
        .get('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 503 when database is unavailable', async () => {
      mockRepository.list.mockRejectedValue(
        new DatabaseError('Connection failed')
      );

      const response = await request(app)
        .get('/api/v1/cases')
        .expect(503);

      expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.message).toContain('retry');
    });

    it('should return 500 for unexpected errors without leaking details', async () => {
      mockRepository.create.mockRejectedValue(
        new Error('Internal secret error with sensitive data')
      );

      const response = await request(app)
        .post('/api/v1/cases')
        .send({
          name: 'Test Case',
          companyName: 'Acme Corp',
        })
        .expect(500);

      expect(response.body.error).toBe('INTERNAL_ERROR');
      expect(response.body.message).toBe('An unexpected error occurred');
      // Ensure no sensitive data leaked
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(JSON.stringify(response.body)).not.toContain('sensitive');
    });
  });
});
