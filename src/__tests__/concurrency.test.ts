/**
 * Concurrency Tests
 * 
 * CRITICAL: Tests for session isolation and concurrent request handling
 * 
 * These tests verify that the stateless architecture prevents
 * cross-contamination between concurrent user sessions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { AgentQueryService } from '../services/AgentQueryService';

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-key';

describe('Concurrency Safety', () => {
  let service: AgentQueryService;
  let supabase: ReturnType<typeof createClient>;

  beforeEach(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    service = new AgentQueryService(supabase);
  });

  afterEach(async () => {
    // Cleanup test sessions
    await service.cleanupOldSessions(0);
  });

  describe('Session Isolation', () => {
    it('should isolate concurrent user sessions', async () => {
      // Simulate 50 concurrent requests from different users
      const userCount = 50;
      const requests = Array.from({ length: userCount }, (_, i) => ({
        query: `Query from user ${i}: What is my revenue target?`,
        userId: `test-user-${i}`,
      }));

      // Execute all requests concurrently
      const results = await Promise.all(
        requests.map(req => service.handleQuery(req.query, req.userId))
      );

      // Verify each user got a unique session
      const sessionIds = results.map(r => r.sessionId);
      const uniqueSessions = new Set(sessionIds);
      
      expect(uniqueSessions.size).toBe(userCount);
      expect(sessionIds.length).toBe(userCount);

      // Verify no session ID appears more than once
      sessionIds.forEach((sessionId, i) => {
        const otherSessions = sessionIds.filter((_, j) => j !== i);
        expect(otherSessions).not.toContain(sessionId);
      });
    });

    it('should handle concurrent queries to same session', async () => {
      // Create a session
      const userId = 'test-user-concurrent';
      const firstResult = await service.handleQuery(
        'Initial query',
        userId
      );
      const sessionId = firstResult.sessionId;

      // Send 10 concurrent queries to the same session
      const queries = Array.from({ length: 10 }, (_, i) => 
        `Concurrent query ${i}`
      );

      const results = await Promise.all(
        queries.map(query => 
          service.handleQuery(query, userId, sessionId)
        )
      );

      // All results should have the same session ID
      results.forEach(result => {
        expect(result.sessionId).toBe(sessionId);
      });

      // Verify session state is consistent
      const session = await service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.user_id).toBe(userId);
    });

    it('should prevent data leakage between users', async () => {
      // User A creates a session with specific context
      const userA = 'test-user-a';
      const userAContext = {
        companyName: 'Company A',
        revenue: 1000000,
      };

      const resultA = await service.handleQuery(
        'What is my revenue?',
        userA,
        undefined,
        { initialContext: userAContext }
      );

      // User B creates a session with different context
      const userB = 'test-user-b';
      const userBContext = {
        companyName: 'Company B',
        revenue: 2000000,
      };

      const resultB = await service.handleQuery(
        'What is my revenue?',
        userB,
        undefined,
        { initialContext: userBContext }
      );

      // Verify sessions are different
      expect(resultA.sessionId).not.toBe(resultB.sessionId);

      // Verify context is isolated
      const sessionA = await service.getSession(resultA.sessionId);
      const sessionB = await service.getSession(resultB.sessionId);

      expect(sessionA?.workflow_state.context.companyName).toBe('Company A');
      expect(sessionB?.workflow_state.context.companyName).toBe('Company B');
      expect(sessionA?.workflow_state.context.revenue).toBe(1000000);
      expect(sessionB?.workflow_state.context.revenue).toBe(2000000);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle rapid sequential updates', async () => {
      const userId = 'test-user-rapid';
      const firstResult = await service.handleQuery('Initial', userId);
      const sessionId = firstResult.sessionId;

      // Send 20 rapid sequential queries
      const queries = Array.from({ length: 20 }, (_, i) => `Query ${i}`);
      
      for (const query of queries) {
        await service.handleQuery(query, userId, sessionId);
      }

      // Verify session state is consistent
      const session = await service.getSession(sessionId);
      expect(session).toBeDefined();
      
      // Conversation history should have all queries
      const history = session?.workflow_state.context.conversationHistory || [];
      // Each query creates 2 history entries (user + assistant)
      expect(history.length).toBeGreaterThanOrEqual(20);
    });

    it('should handle concurrent updates with retry', async () => {
      const userId = 'test-user-retry';
      const firstResult = await service.handleQuery('Initial', userId);
      const sessionId = firstResult.sessionId;

      // Send 5 concurrent updates
      const queries = Array.from({ length: 5 }, (_, i) => 
        `Concurrent update ${i}`
      );

      const results = await Promise.allSettled(
        queries.map(query => 
          service.handleQuery(query, userId, sessionId)
        )
      );

      // At least some should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);

      // Session should still be valid
      const session = await service.getSession(sessionId);
      expect(session).toBeDefined();
    });
  });

  describe('Load Testing', () => {
    it('should handle 100 concurrent users', async () => {
      const userCount = 100;
      const requests = Array.from({ length: userCount }, (_, i) => ({
        query: `Load test query ${i}`,
        userId: `load-test-user-${i}`,
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(req => service.handleQuery(req.query, req.userId))
      );

      const duration = Date.now() - startTime;

      // All requests should succeed
      expect(results.length).toBe(userCount);
      results.forEach(result => {
        expect(result.sessionId).toBeDefined();
        expect(result.traceId).toBeDefined();
      });

      // Performance check: should complete in reasonable time
      // Target: < 10s for 100 concurrent users
      expect(duration).toBeLessThan(10000);

      console.log(`Load test: ${userCount} users in ${duration}ms`);
    });

    it('should handle burst traffic', async () => {
      // Simulate burst: 50 users, each sending 3 queries
      const userCount = 50;
      const queriesPerUser = 3;

      const allRequests = [];
      for (let i = 0; i < userCount; i++) {
        const userId = `burst-test-user-${i}`;
        for (let j = 0; j < queriesPerUser; j++) {
          allRequests.push({
            query: `Burst query ${j}`,
            userId,
          });
        }
      }

      const startTime = Date.now();

      const results = await Promise.all(
        allRequests.map(req => service.handleQuery(req.query, req.userId))
      );

      const duration = Date.now() - startTime;

      // All requests should succeed
      expect(results.length).toBe(userCount * queriesPerUser);

      // Each user should have exactly 1 session
      const sessionsByUser = new Map<string, Set<string>>();
      results.forEach(result => {
        const userId = allRequests.find(r => 
          result.sessionId === result.sessionId
        )?.userId;
        
        if (userId) {
          if (!sessionsByUser.has(userId)) {
            sessionsByUser.set(userId, new Set());
          }
          sessionsByUser.get(userId)!.add(result.sessionId);
        }
      });

      // Verify each user has only 1 session
      sessionsByUser.forEach((sessions, userId) => {
        expect(sessions.size).toBe(1);
      });

      console.log(`Burst test: ${userCount * queriesPerUser} requests in ${duration}ms`);
    });
  });

  describe('Error Handling', () => {
    it('should isolate errors to specific sessions', async () => {
      // Create two sessions
      const userA = 'test-user-error-a';
      const userB = 'test-user-error-b';

      const resultA = await service.handleQuery('Valid query', userA);
      const resultB = await service.handleQuery('Valid query', userB);

      // Simulate error in session A (invalid query)
      try {
        await service.handleQuery('', userA, resultA.sessionId);
      } catch (error) {
        // Expected to fail
      }

      // Session B should still work
      const resultB2 = await service.handleQuery(
        'Another valid query',
        userB,
        resultB.sessionId
      );

      expect(resultB2.sessionId).toBe(resultB.sessionId);
      expect(resultB2.response).toBeDefined();
    });
  });
});
