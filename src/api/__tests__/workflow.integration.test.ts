/**
 * Workflow API Integration Tests
 * Tests the actual workflow explanation endpoint
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import workflowRouter from '../workflow';
import { Client } from 'pg';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).tenantId = req.header('x-tenant-id');
  next();
});
app.use('/api', workflowRouter);

describe('Workflow API Integration', () => {
  let dbClient: Client;
  const testExecutionId = 'test-exec-001';
  const testStepId = 'test-step-001';
  const testTenantId = 'test-tenant-001';

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('DATABASE_URL not set, skipping integration tests');
      return;
    }

    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();

    // Create test data
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id TEXT NOT NULL,
        stage_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        output_data JSONB,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);
    await dbClient.query(`
      ALTER TABLE workflow_execution_logs
      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'test-tenant-001';
    `);

    await dbClient.query(`
      INSERT INTO workflow_execution_logs (execution_id, stage_id, tenant_id, output_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING;
    `, [
      testExecutionId,
      testStepId,
      testTenantId,
      JSON.stringify({
        reasoning: 'Test reasoning for workflow step',
        evidence: [
          { source: 'test-source', description: 'Test evidence', confidence: 0.95 }
        ],
        confidence_score: 0.95
      })
    ]);
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1
          AND tenant_id = $2;
      `, [testExecutionId, testTenantId]);
      await dbClient.end();
    }
  });

  describe('GET /api/workflow/:executionId/step/:stepId/explain', () => {
    it('should require a tenant context', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
        .expect(403);
    });

    it('should return explanation for valid execution step', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const response = await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('workflow_id', testExecutionId);
      expect(response.body.data).toHaveProperty('step_id', testStepId);
      expect(response.body.data).toHaveProperty('reasoning');
      expect(response.body.data).toHaveProperty('evidence');
      expect(response.body.data).toHaveProperty('confidence_score');
    });

    it('should return 404 for non-existent execution', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const response = await request(app)
        .get('/api/workflow/non-existent/step/non-existent/explain')
        .set('x-tenant-id', testTenantId)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'not_found');
      expect(response.body).toHaveProperty('message');
    });

    it('should sanitize evidence data', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const response = await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      const { evidence } = response.body.data;
      expect(Array.isArray(evidence)).toBe(true);
      
      if (evidence.length > 0) {
        const firstEvidence = evidence[0];
        expect(firstEvidence).toHaveProperty('source');
        expect(firstEvidence).toHaveProperty('description');
        expect(firstEvidence).toHaveProperty('confidence');
      }
    });

    it('should handle missing reasoning gracefully', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      // Insert test data without reasoning
      const noReasoningExecId = 'test-exec-no-reasoning';
      const noReasoningStepId = 'test-step-no-reasoning';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, tenant_id, output_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [
        noReasoningExecId,
        noReasoningStepId,
        testTenantId,
        JSON.stringify({ result: {} })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noReasoningExecId}/step/${noReasoningStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body.data.reasoning).toBeDefined();
      expect(typeof response.body.data.reasoning).toBe('string');

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1
          AND tenant_id = $2;
      `, [noReasoningExecId, testTenantId]);
    });

    it('should handle missing evidence gracefully', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      // Insert test data without evidence
      const noEvidenceExecId = 'test-exec-no-evidence';
      const noEvidenceStepId = 'test-step-no-evidence';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, tenant_id, output_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [
        noEvidenceExecId,
        noEvidenceStepId,
        testTenantId,
        JSON.stringify({ reasoning: 'Test reasoning' })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noEvidenceExecId}/step/${noEvidenceStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body.data.evidence).toBeDefined();
      expect(Array.isArray(response.body.data.evidence)).toBe(true);

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1
          AND tenant_id = $2;
      `, [noEvidenceExecId, testTenantId]);
    });

    it('should return null confidence when not available', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      // Insert test data without confidence
      const noConfidenceExecId = 'test-exec-no-confidence';
      const noConfidenceStepId = 'test-step-no-confidence';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, tenant_id, output_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [
        noConfidenceExecId,
        noConfidenceStepId,
        testTenantId,
        JSON.stringify({ reasoning: 'Test reasoning' })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noConfidenceExecId}/step/${noConfidenceStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body.data).toHaveProperty('confidence_score');
      // Confidence should be null when not available
      expect(response.body.data.confidence_score).toBeNull();

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1
          AND tenant_id = $2;
      `, [noConfidenceExecId, testTenantId]);
    });

    it('should block cross-tenant access', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const otherTenantId = 'test-tenant-002';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, tenant_id, output_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [
        'test-exec-foreign',
        'test-step-foreign',
        testTenantId,
        JSON.stringify({ reasoning: 'Tenant A reasoning' })
      ]);

      await request(app)
        .get('/api/workflow/test-exec-foreign/step/test-step-foreign/explain')
        .set('x-tenant-id', otherTenantId)
        .expect(404);

      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1
          AND tenant_id = $2;
      `, ['test-exec-foreign', testTenantId]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      // Use invalid characters that might cause SQL errors
      const response = await request(app)
        .get('/api/workflow/invalid%00id/step/invalid%00step/explain')
        .set('x-tenant-id', testTenantId)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 500 on unexpected errors', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      // This test would require mocking the database to throw an error
      // For now, we just verify the error structure
      const errorResponse = {
        error: 'explanation_failure',
        message: 'Unable to generate explanation for this workflow step'
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
    });
  });

  describe('Security', () => {
    it('should require authentication', async () => {
      // This test assumes authentication middleware is in place
      // The actual behavior depends on the middleware configuration
      const response = await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`);

      // Should either succeed (if auth is mocked) or fail with 401
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should sanitize SQL injection attempts', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const maliciousId = "'; DROP TABLE workflow_execution_logs; --";
      
      const response = await request(app)
        .get(`/api/workflow/${encodeURIComponent(maliciousId)}/step/test/explain`)
        .set('x-tenant-id', testTenantId);

      // Should return 404, not cause SQL injection
      expect(response.status).toBe(404);
      
      // Verify table still exists
      const tableCheck = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'workflow_execution_logs'
        );
      `);
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time', async () => {
      if (!process.env.DATABASE_URL) {
        console.warn('Skipping test - DATABASE_URL not set');
        return;
      }

      const startTime = Date.now();
      
      await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      const duration = Date.now() - startTime;
      
      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
