import express, { Express } from 'express';
import request from 'supertest';
import { vi } from "vitest";
/**
 * Value Drivers API Tests
 * 
 * Tests for: happy path, validation failure, auth failure, dependency failure
 */


import {
  DbConflictError,
  DbNotFoundError,
  TransientDbError,
} from '../../../lib/db/errors';
import { valueDriversRouter } from '../index.js'
import { getValueDriversRepository } from '../repository.js'

// Mock the repository
vi.mock('../repository');

// Mock auth middleware
vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    req.user = { id: 'user-123', email: 'admin@example.com', roles: ['admin'] };
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

describe('Value Drivers API', () => {
  let app: Express;
  let mockRepository: jest.Mocked<ReturnType<typeof getValueDriversRepository>>;

  const validDriverData = {
    name: 'Demo Prep Time Reduction',
    description: 'Reduce time spent preparing for demos',
    type: 'productivity_gain',
    personaTags: ['se_director', 'vp_sales'],
    salesMotionTags: ['new_logo', 'expansion'],
    formula: {
      expression: 'demosPerMonth * timeSaved * hourlyRate * 12',
      variables: [
        { id: 'demosPerMonth', name: 'demosPerMonth', label: 'Demos per month', defaultValue: 20, unit: 'demos' },
        { id: 'timeSaved', name: 'timeSaved', label: 'Time saved', defaultValue: 1.5, unit: 'hours' },
        { id: 'hourlyRate', name: 'hourlyRate', label: 'Hourly rate', defaultValue: 80, unit: '$/hr' },
      ],
      resultUnit: 'currency',
    },
    narrativePitch: 'Cut demo prep time in half—freeing SEs to run more demos.',
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/drivers', valueDriversRouter);

    mockRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      incrementUsage: vi.fn(),
    } as any;

    (getValueDriversRepository as jest.Mock).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Happy Path Tests
  // =========================================================================

  describe('POST /api/v1/drivers - Create', () => {
    it('should create a value driver successfully', async () => {
      const createdDriver = {
        id: 'driver-123',
        tenantId: 'tenant-123',
        ...validDriverData,
        status: 'draft',
        version: 1,
        usageCount: 0,
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(createdDriver);

      const response = await request(app)
        .post('/api/v1/drivers')
        .send(validDriverData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: 'driver-123',
        name: 'Demo Prep Time Reduction',
        type: 'productivity_gain',
      });
      expect(mockRepository.create).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
        expect.objectContaining({ name: validDriverData.name })
      );
    });
  });

  describe('GET /api/v1/drivers - List', () => {
    it('should list value drivers with pagination', async () => {
      const drivers = [
        { id: 'driver-1', name: 'Driver 1', status: 'published' },
        { id: 'driver-2', name: 'Driver 2', status: 'published' },
      ];

      mockRepository.list.mockResolvedValue({
        data: drivers as any,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasMore: false,
        },
      });

      const response = await request(app)
        .get('/api/v1/drivers')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter by type', async () => {
      mockRepository.list.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      });

      await request(app)
        .get('/api/v1/drivers?type=cost_savings')
        .expect(200);

      expect(mockRepository.list).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ type: 'cost_savings' })
      );
    });
  });

  describe('GET /api/v1/drivers/:driverId - Get One', () => {
    it('should return a single value driver', async () => {
      const driver = {
        id: 'driver-123',
        name: 'Test Driver',
        status: 'published',
      };

      mockRepository.getById.mockResolvedValue(driver as any);

      const response = await request(app)
        .get('/api/v1/drivers/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.data.id).toBe('driver-123');
    });
  });

  describe('PATCH /api/v1/drivers/:driverId - Update', () => {
    it('should update a value driver and increment version', async () => {
      const updatedDriver = {
        id: 'driver-123',
        name: 'Updated Name',
        version: 2,
      };

      mockRepository.update.mockResolvedValue(updatedDriver as any);

      const response = await request(app)
        .patch('/api/v1/drivers/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.version).toBe(2);
    });
  });

  describe('DELETE /api/v1/drivers/:driverId - Delete', () => {
    it('should delete a value driver', async () => {
      mockRepository.delete.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/v1/drivers/550e8400-e29b-41d4-a716-446655440000')
        .expect(204);

      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/drivers/:driverId/usage - Track Usage', () => {
    it('should track driver usage', async () => {
      mockRepository.incrementUsage.mockResolvedValue(undefined);

      await request(app)
        .post('/api/v1/drivers/550e8400-e29b-41d4-a716-446655440000/usage')
        .expect(204);

      expect(mockRepository.incrementUsage).toHaveBeenCalledWith(
        'tenant-123',
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });
  });

  // =========================================================================
  // Validation Failure Tests
  // =========================================================================

  describe('Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/drivers')
        .send({ name: 'Test' }) // Missing required fields
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toBeDefined();
    });

    it('should return 400 for invalid formula expression', async () => {
      const invalidData = {
        ...validDriverData,
        formula: {
          ...validDriverData.formula,
          expression: 'eval("malicious code")', // Should be rejected
        },
      };

      const response = await request(app)
        .post('/api/v1/drivers')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid persona tag', async () => {
      const invalidData = {
        ...validDriverData,
        personaTags: ['invalid_persona'],
      };

      const response = await request(app)
        .post('/api/v1/drivers')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid UUID in path', async () => {
      const response = await request(app)
        .get('/api/v1/drivers/not-a-uuid')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('UUID');
    });

    it('should reject unknown fields in request body', async () => {
      const response = await request(app)
        .post('/api/v1/drivers')
        .send({
          ...validDriverData,
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
    it('should return 403 for non-admin trying to create', async () => {
      const { requireRole } = require('../../../middleware/auth');
      (requireRole as jest.Mock).mockImplementationOnce(() => (_req: any, res: any) => {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Admin access required',
        });
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/v1/drivers', valueDriversRouter);

      const response = await request(testApp)
        .post('/api/v1/drivers')
        .send(validDriverData)
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Dependency Failure Tests
  // =========================================================================

  describe('Dependency Errors', () => {
    it('should return 404 when driver not found', async () => {
      mockRepository.getById.mockRejectedValue(
        new DbNotFoundError('ValueDriver', 'driver-123')
      );

      const response = await request(app)
        .get('/api/v1/drivers/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 409 for duplicate driver name', async () => {
      mockRepository.create.mockRejectedValue(
        new DbConflictError('A driver with this name already exists')
      );

      const response = await request(app)
        .post('/api/v1/drivers')
        .send(validDriverData)
        .expect(409);

      expect(response.body.error).toBe('CONFLICT');
    });

    it('should return 503 when database is unavailable', async () => {
      mockRepository.list.mockRejectedValue(
        new TransientDbError('Database temporarily unavailable')
      );

      const response = await request(app)
        .get('/api/v1/drivers')
        .expect(503);

      expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
      expect(response.body.details.retryHint).toBeDefined();
    });

    it('should return 500 for unexpected errors without leaking details', async () => {
      mockRepository.create.mockRejectedValue(
        new Error('Database password: secret123')
      );

      const response = await request(app)
        .post('/api/v1/drivers')
        .send(validDriverData)
        .expect(500);

      expect(response.body.error).toBe('INTERNAL_ERROR');
      expect(response.body.message).toBe('An unexpected error occurred');
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(JSON.stringify(response.body)).not.toContain('password');
    });
  });
});
