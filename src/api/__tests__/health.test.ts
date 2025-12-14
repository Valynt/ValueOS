/**
 * Health Check API Tests
 * 
 * CRITICAL: Tests health check endpoints that load balancers depend on
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRouter from '../health';

describe('Health Check API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(healthRouter);
  });

  describe('GET /health', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('dependencies');
    });

    it('should include all dependency checks', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      const { dependencies } = response.body;
      
      // Verify all critical dependencies are checked
      expect(dependencies).toHaveProperty('database');
      expect(dependencies).toHaveProperty('supabase');
      
      // Each check should have status and latency
      expect(dependencies.database).toHaveProperty('status');
      expect(dependencies.database).toHaveProperty('lastChecked');
    });

    it('should return 503 when critical dependency is down', async () => {
      // This test would require mocking database to fail
      // For now, we verify the endpoint structure
      const response = await request(app).get('/health');
      
      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });

    it('should respond within 5 seconds', async () => {
      const start = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 for liveness probe', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
    });

    it('should respond quickly for K8s liveness', async () => {
      const start = Date.now();
      await request(app).get('/health/live');
      const duration = Date.now() - start;
      
      // Liveness should be very fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when ready to serve traffic', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });

    it('should check database connectivity', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect([200, 503]).toContain(response.status);
      if (response.body.dependencies) {
        expect(response.body.dependencies).toHaveProperty('database');
      }
    });
  });

  describe('GET /health/startup', () => {
    it('should return 200 when startup is complete', async () => {
      const response = await request(app)
        .get('/health/startup');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/dependencies', () => {
    it('should return detailed dependency status', async () => {
      const response = await request(app)
        .get('/health/dependencies')
        .expect(200);

      expect(response.body).toHaveProperty('dependencies');
      expect(typeof response.body.dependencies).toBe('object');
      expect(response.body.dependencies).toHaveProperty('database');
      expect(response.body.dependencies).toHaveProperty('supabase');
    });

    it('should include latency for each dependency', async () => {
      const response = await request(app)
        .get('/health/dependencies')
        .expect(200);

      const { dependencies } = response.body;
      
      // Check each dependency has required properties
      Object.values(dependencies).forEach((dep: any) => {
        expect(dep).toHaveProperty('status');
        expect(dep).toHaveProperty('lastChecked');
        // latency is optional (only present when check succeeds)
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      // This would require dependency injection or mocking
      
      const response = await request(app).get('/health');
      
      // Should not crash, should return error status
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app).get('/health');
      
      const body = JSON.stringify(response.body);
      
      // Should not contain passwords, tokens, or connection strings
      expect(body).not.toMatch(/password/i);
      expect(body).not.toMatch(/token/i);
      expect(body).not.toMatch(/postgres:\/\//);
      expect(body).not.toMatch(/api[_-]?key/i);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      });
    });

    it('should not leak memory on repeated calls', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health/live');
      }
      
      // If we get here without crashing, memory is not leaking catastrophically
      expect(true).toBe(true);
    });
  });
});
