/**
 * E2E Tests for LLM Workflow
 * 
 * Tests complete user workflows involving LLM interactions
 * with mocked LLM responses for deterministic testing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { mockLLMProvider } from '../mocks/llmProvider';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestUser, getAuthToken } from '../helpers/auth';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeMaybe = runIntegration ? describe : describe.skip;

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describeMaybe('E2E: LLM Workflow', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser({
      email: 'test@example.com',
      tier: 'pro'
    });
    userId = user.id;
    authToken = await getAuthToken(user.id);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    mockLLMProvider.reset();
  });

  describe('Canvas Generation', () => {
    it('should generate a business model canvas using LLM', async () => {
      // Mock LLM response
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        model: 'meta-llama/Llama-3-70b-chat-hf',
        response: JSON.stringify({
          keyPartners: ['Technology providers', 'Distribution partners'],
          keyActivities: ['Product development', 'Customer support'],
          valuePropositions: ['Innovative solution', 'Cost-effective'],
          customerRelationships: ['Personal assistance', 'Self-service'],
          customerSegments: ['SMBs', 'Enterprises'],
          keyResources: ['Engineering team', 'Technology platform'],
          channels: ['Direct sales', 'Online platform'],
          costStructure: ['Development costs', 'Marketing expenses'],
          revenueStreams: ['Subscription fees', 'Professional services']
        })
      });

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessDescription: 'A SaaS platform for project management',
          industry: 'Technology',
          targetMarket: 'SMBs'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('canvasId');
      expect(response.body.data.canvas).toHaveProperty('keyPartners');
      expect(response.body.data.canvas.keyPartners).toContain('Technology providers');
      
      // Verify LLM was called
      expect(mockLLMProvider.getCallCount()).toBe(1);
      const lastCall = mockLLMProvider.getLastCall();
      expect(lastCall.prompt).toContain('business model canvas');
      expect(lastCall.prompt).toContain('project management');
    });

    it('should handle LLM rate limiting gracefully', async () => {
      // Mock rate limit error
      mockLLMProvider.mockError({
        statusCode: 429,
        message: 'Rate limit exceeded'
      });

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessDescription: 'Test business',
          industry: 'Technology'
        })
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body).toHaveProperty('upgradeUrl');
    });

    it('should fallback to OpenAI when Together.ai fails', async () => {
      // Mock Together.ai failure
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        error: new Error('Service unavailable')
      });

      // Mock OpenAI success
      mockLLMProvider.mockResponse({
        provider: 'openai',
        model: 'gpt-4',
        response: JSON.stringify({
          keyPartners: ['Partners from OpenAI'],
          keyActivities: ['Activities'],
          valuePropositions: ['Value'],
          customerRelationships: ['Relationships'],
          customerSegments: ['Segments'],
          keyResources: ['Resources'],
          channels: ['Channels'],
          costStructure: ['Costs'],
          revenueStreams: ['Revenue']
        })
      });

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessDescription: 'Test business'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('openai');
      expect(mockLLMProvider.getCallCount()).toBe(2); // Together.ai + OpenAI
    });
  });

  describe('Canvas Refinement', () => {
    let canvasId: string;

    beforeEach(async () => {
      // Create initial canvas
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        response: JSON.stringify({
          keyPartners: ['Initial partners'],
          keyActivities: ['Initial activities'],
          valuePropositions: ['Initial value'],
          customerRelationships: ['Initial relationships'],
          customerSegments: ['Initial segments'],
          keyResources: ['Initial resources'],
          channels: ['Initial channels'],
          costStructure: ['Initial costs'],
          revenueStreams: ['Initial revenue']
        })
      });

      const createResponse = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test business' });

      canvasId = createResponse.body.data.canvasId;
    });

    it('should refine canvas section with LLM suggestions', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        response: JSON.stringify({
          suggestions: [
            'Consider strategic partnerships with industry leaders',
            'Explore co-development opportunities',
            'Build ecosystem partnerships'
          ],
          reasoning: 'These partnerships will strengthen market position'
        })
      });

      const response = await request(API_URL)
        .post(`/api/canvas/${canvasId}/refine`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          section: 'keyPartners',
          context: 'We want to expand into enterprise market'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toHaveLength(3);
      expect(response.body.data.suggestions[0]).toContain('strategic partnerships');
    });

    it('should use cached LLM responses for identical queries', async () => {
      mockLLMProvider.mockResponse({
        provider: 'cache',
        cached: true,
        response: JSON.stringify({
          suggestions: ['Cached suggestion']
        })
      });

      // First request
      const response1 = await request(API_URL)
        .post(`/api/canvas/${canvasId}/refine`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          section: 'keyPartners',
          context: 'Same context'
        })
        .expect(200);

      // Second identical request
      const response2 = await request(API_URL)
        .post(`/api/canvas/${canvasId}/refine`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          section: 'keyPartners',
          context: 'Same context'
        })
        .expect(200);

      expect(response1.body.data.cached).toBe(false);
      expect(response2.body.data.cached).toBe(true);
      expect(response2.body.data.cost).toBe(0);
    });
  });

  describe('Cost Tracking', () => {
    it('should track LLM usage costs per user', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        model: 'meta-llama/Llama-3-70b-chat-hf',
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300
        },
        cost: 0.00027 // $0.0009 per 1K tokens
      });

      await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test' })
        .expect(200);

      const usageResponse = await request(API_URL)
        .get('/api/user/llm-usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(usageResponse.body.data.totalCost).toBeGreaterThan(0);
      expect(usageResponse.body.data.requestCount).toBeGreaterThan(0);
      expect(usageResponse.body.data.tokenUsage).toHaveProperty('total');
    });

    it('should alert when approaching cost limits', async () => {
      // Make multiple requests to approach limit
      for (let i = 0; i < 5; i++) {
        mockLLMProvider.mockResponse({
          provider: 'together_ai',
          cost: 2.0 // High cost to trigger alert
        });

        await request(API_URL)
          .post('/api/canvas/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ businessDescription: `Test ${i}` });
      }

      const alertsResponse = await request(API_URL)
        .get('/api/user/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const costAlert = alertsResponse.body.data.alerts.find(
        (a: any) => a.type === 'COST_THRESHOLD'
      );
      expect(costAlert).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed LLM responses', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        response: 'Invalid JSON response'
      });

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test' })
        .expect(500);

      expect(response.body.error).toContain('Failed to parse LLM response');
    });

    it('should handle LLM timeout', async () => {
      mockLLMProvider.mockTimeout(35000); // Longer than circuit breaker timeout

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test' })
        .expect(504);

      expect(response.body.error).toContain('timeout');
    });

    it('should handle both providers being down', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        error: new Error('Service unavailable')
      });

      mockLLMProvider.mockResponse({
        provider: 'openai',
        error: new Error('Service unavailable')
      });

      const response = await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test' })
        .expect(503);

      expect(response.body.error).toContain('All LLM providers unavailable');
    });
  });

  describe('Performance', () => {
    it('should complete canvas generation within SLA', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        latency: 2000, // 2 seconds
        response: JSON.stringify({
          keyPartners: ['Partners'],
          keyActivities: ['Activities'],
          valuePropositions: ['Value'],
          customerRelationships: ['Relationships'],
          customerSegments: ['Segments'],
          keyResources: ['Resources'],
          channels: ['Channels'],
          costStructure: ['Costs'],
          revenueStreams: ['Revenue']
        })
      });

      const startTime = Date.now();
      
      await request(API_URL)
        .post('/api/canvas/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ businessDescription: 'Test' })
        .expect(200);

      const duration = Date.now() - startTime;
      
      // SLA: 5 seconds for canvas generation
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockLLMProvider.mockResponse({
        provider: 'together_ai',
        response: JSON.stringify({
          keyPartners: ['Partners'],
          keyActivities: ['Activities'],
          valuePropositions: ['Value'],
          customerRelationships: ['Relationships'],
          customerSegments: ['Segments'],
          keyResources: ['Resources'],
          channels: ['Channels'],
          costStructure: ['Costs'],
          revenueStreams: ['Revenue']
        })
      });

      const requests = Array(10).fill(null).map((_, i) =>
        request(API_URL)
          .post('/api/canvas/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ businessDescription: `Test ${i}` })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (not sequential)
      expect(duration).toBeLessThan(10000); // 10 seconds for 10 concurrent requests
    });
  });
});
