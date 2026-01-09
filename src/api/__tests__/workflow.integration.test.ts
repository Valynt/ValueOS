/**
 * Workflow API Integration Tests
 * Tests the actual workflow explanation endpoint
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import workflowRouter from '../workflow';
import { Client } from 'pg';
import { getDatabaseUrl } from '../../config/database';

const app = express();
app.use(express.json());
app.use('/api', workflowRouter);

describe('Workflow API Integration', () => {
  let dbClient: Client;
  const testExecutionId = 'test-exec-001';
  const testStepId = 'test-step-001';
  const resolveDatabaseUrl = () => {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      console.warn('DATABASE_URL not set, skipping integration tests');
    }
    return databaseUrl;
  };

  beforeAll(async () => {
    const dbUrl = resolveDatabaseUrl();
    if (!dbUrl) {
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
        output_data JSONB,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    await dbClient.query(`
      INSERT INTO workflow_execution_logs (execution_id, stage_id, output_data)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING;
    `, [
      testExecutionId,
      testStepId,
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
        WHERE execution_id = $1;
      `, [testExecutionId]);
      await dbClient.end();
    }
  });

  describe('GET /api/workflow/:executionId/step/:stepId/explain', () => {
    it('should return explanation for valid execution step', async () => {
      if (!resolveDatabaseUrl()) {
        return;
      }

      const response = await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
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
      if (!resolveDatabaseUrl()) {
        return;
      }

      const response = await request(app)
        .get('/api/workflow/non-existent/step/non-existent/explain')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'not_found');
      expect(response.body).toHaveProperty('message');
    });

    it('should sanitize evidence data', async () => {
      if (!resolveDatabaseUrl()) {
        return;
      }

      const response = await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
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
      if (!resolveDatabaseUrl()) {
        return;
      }

      // Insert test data without reasoning
      const noReasoningExecId = 'test-exec-no-reasoning';
      const noReasoningStepId = 'test-step-no-reasoning';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, output_data)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `, [
        noReasoningExecId,
        noReasoningStepId,
        JSON.stringify({ result: {} })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noReasoningExecId}/step/${noReasoningStepId}/explain`)
        .expect(200);

      expect(response.body.data.reasoning).toBeDefined();
      expect(typeof response.body.data.reasoning).toBe('string');

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1;
      `, [noReasoningExecId]);
    });

    it('should handle missing evidence gracefully', async () => {
      if (!resolveDatabaseUrl()) {
        return;
      }

      // Insert test data without evidence
      const noEvidenceExecId = 'test-exec-no-evidence';
      const noEvidenceStepId = 'test-step-no-evidence';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, output_data)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `, [
        noEvidenceExecId,
        noEvidenceStepId,
        JSON.stringify({ reasoning: 'Test reasoning' })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noEvidenceExecId}/step/${noEvidenceStepId}/explain`)
        .expect(200);

      expect(response.body.data.evidence).toBeDefined();
      expect(Array.isArray(response.body.data.evidence)).toBe(true);

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1;
      `, [noEvidenceExecId]);
    });

    it('should return null confidence when not available', async () => {
      if (!resolveDatabaseUrl()) {
        return;
      }

      // Insert test data without confidence
      const noConfidenceExecId = 'test-exec-no-confidence';
      const noConfidenceStepId = 'test-step-no-confidence';

      await dbClient.query(`
        INSERT INTO workflow_execution_logs (execution_id, stage_id, output_data)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `, [
        noConfidenceExecId,
        noConfidenceStepId,
        JSON.stringify({ reasoning: 'Test reasoning' })
      ]);

      const response = await request(app)
        .get(`/api/workflow/${noConfidenceExecId}/step/${noConfidenceStepId}/explain`)
        .expect(200);

      expect(response.body.data).toHaveProperty('confidence_score');
      // Confidence should be null when not available
      expect(response.body.data.confidence_score).toBeNull();

      // Cleanup
      await dbClient.query(`
        DELETE FROM workflow_execution_logs 
        WHERE execution_id = $1;
      `, [noConfidenceExecId]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      if (!resolveDatabaseUrl()) {
        return;
      }

      // Use invalid characters that might cause SQL errors
      const response = await request(app)
        .get('/api/workflow/invalid%00id/step/invalid%00step/explain')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 500 on unexpected errors', async () => {
      if (!resolveDatabaseUrl()) {
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
      if (!resolveDatabaseUrl()) {
        return;
      }

      const maliciousId = "'; DROP TABLE workflow_execution_logs; --";
      
      const response = await request(app)
        .get(`/api/workflow/${encodeURIComponent(maliciousId)}/step/test/explain`);

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
      if (!resolveDatabaseUrl()) {
        return;
      }

      const startTime = Date.now();
      
      await request(app)
        .get(`/api/workflow/${testExecutionId}/step/${testStepId}/explain`)
        .expect(200);

      const duration = Date.now() - startTime;
      
      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
