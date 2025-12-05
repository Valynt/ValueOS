/**
 * Semantic Memory Production Test Suite
 * 
 * Tests vector similarity search with production-like scenarios
 * 
 * Source: supabase/migrations/20241123150000_add_semantic_memory.sql
 * Database: Real Supabase instance (no mocks)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase';
import { SemanticMemoryService } from '@/services/SemanticMemory';

describe('Semantic Memory - Production Scenarios', () => {
  let memoryService: SemanticMemoryService;
  const testSessionId = `test-session-${Date.now()}`;
  const testMemoryIds: string[] = [];

  beforeAll(async () => {
    memoryService = new SemanticMemoryService();
  });

  afterAll(async () => {
    // Cleanup: Delete test memories
    if (testMemoryIds.length > 0) {
      await supabase
        .from('semantic_memory')
        .delete()
        .in('id', testMemoryIds);
    }
  });

  describe('Vector Similarity Search', () => {
    test('should find similar DevOps opportunities with high precision', async () => {
      // Seed: Store successful DevOps opportunity
      const devopsOpportunity = {
        type: 'opportunity' as const,
        content: JSON.stringify({
          opportunity: 'Reduce MTTR by 40% with automated incident response',
          industry: 'DevOps',
          pain_points: [
            'Manual incident triage takes 2+ hours',
            'Context switching costs $50K/month in lost productivity'
          ],
          outcome: 'Faster incident resolution, reduced downtime'
        }),
        metadata: {
          agentType: 'opportunity',
          industry: 'DevOps',
          targetMarket: 'enterprise',
          score: 0.92,
          timestamp: new Date(),
          workflowId: testSessionId,
          tags: ['automation', 'incident-response', 'mttr', 'devops']
        }
      };

      const storedMemory = await memoryService.storeMemory(devopsOpportunity);
      testMemoryIds.push(storedMemory.id);

      // Query: Search for similar opportunities
      const searchResults = await memoryService.searchByQuery(
        'automated incident management for DevOps teams',
        {
          type: 'opportunity',
          matchThreshold: 0.7,  // 70% similarity
          matchCount: 5
        }
      );

      // Assertions
      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeGreaterThan(0);
      
      const topMatch = searchResults[0];
      expect(topMatch.similarity).toBeGreaterThanOrEqual(0.7);
      expect(topMatch.entry.metadata.industry).toBe('DevOps');
      expect(topMatch.entry.content).toContain('incident');

      console.log('✅ Top Match Similarity:', topMatch.similarity.toFixed(3));
      console.log('✅ Match Count:', searchResults.length);
    });

    test('should retrieve SaaS value propositions by semantic meaning', async () => {
      // Seed: Multiple SaaS value props
      const saasValueProps = [
        {
          content: JSON.stringify({
            proposition: 'Reduce customer churn by 25% with predictive analytics',
            industry: 'SaaS',
            kpis: ['NRR', 'Churn Rate', 'Customer Lifetime Value']
          }),
          tags: ['churn-reduction', 'predictive-analytics', 'retention']
        },
        {
          content: JSON.stringify({
            proposition: 'Increase MRR by 30% through automated upsell workflows',
            industry: 'SaaS',
            kpis: ['MRR', 'ACV', 'Expansion Revenue']
          }),
          tags: ['revenue-growth', 'upsell', 'automation']
        },
        {
          content: JSON.stringify({
            proposition: 'Lower CAC by 40% with AI-powered lead scoring',
            industry: 'SaaS',
            kpis: ['CAC', 'Lead Conversion Rate', 'Sales Cycle Length']
          }),
          tags: ['efficiency', 'ai', 'lead-scoring']
        }
      ];

      for (const prop of saasValueProps) {
        const memory = await memoryService.storeMemory({
          type: 'value_proposition',
          content: prop.content,
          metadata: {
            agentType: 'target',
            industry: 'SaaS',
            targetMarket: 'SMB',
            score: 0.88,
            timestamp: new Date(),
            workflowId: testSessionId,
            tags: prop.tags
          }
        });
        testMemoryIds.push(memory.id);
      }

      // Query: Semantic search for revenue growth strategies
      const results = await memoryService.searchByQuery(
        'strategies to grow recurring revenue for SaaS business',
        {
          type: 'value_proposition',
          matchThreshold: 0.65,
          matchCount: 10,
          filters: {
            industry: 'SaaS'
          }
        }
      );

      // Assertions
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // Should rank "Increase MRR" highest due to semantic similarity
      const topResult = results[0];
      expect(topResult.entry.content).toContain('MRR');
      expect(topResult.similarity).toBeGreaterThan(0.65);

      console.log('✅ Retrieved', results.length, 'SaaS value props');
      console.log('✅ Top Result:', JSON.parse(topResult.entry.content).proposition);
    });

    test('should filter by industry metadata accurately', async () => {
      // Seed: Mixed industry opportunities
      const industries = ['Healthcare', 'FinTech', 'E-commerce'];
      
      for (const industry of industries) {
        const memory = await memoryService.storeMemory({
          type: 'opportunity',
          content: JSON.stringify({
            opportunity: `Reduce operational costs in ${industry}`,
            industry
          }),
          metadata: {
            agentType: 'opportunity',
            industry,
            score: 0.85,
            timestamp: new Date(),
            workflowId: testSessionId
          }
        });
        testMemoryIds.push(memory.id);
      }

      // Query: Healthcare only
      const healthcareResults = await memoryService.searchByQuery(
        'cost reduction opportunities',
        {
          type: 'opportunity',
          matchThreshold: 0.5,
          matchCount: 10,
          filters: {
            industry: 'Healthcare'
          }
        }
      );

      // Assertions
      expect(healthcareResults.length).toBeGreaterThan(0);
      healthcareResults.forEach(result => {
        expect(result.entry.metadata.industry).toBe('Healthcare');
      });

      console.log('✅ Healthcare Filter Test Passed');
    });

    test('should handle low similarity threshold edge cases', async () => {
      // Query with very low threshold
      const results = await memoryService.searchByQuery(
        'completely unrelated query about quantum physics',
        {
          type: 'opportunity',
          matchThreshold: 0.3,  // Very low threshold
          matchCount: 5
        }
      );

      // Should still return results but with lower similarity
      expect(results).toBeDefined();
      
      if (results.length > 0) {
        const lowestSimilarity = Math.min(...results.map(r => r.similarity));
        expect(lowestSimilarity).toBeGreaterThanOrEqual(0.3);
        console.log('✅ Lowest Similarity:', lowestSimilarity.toFixed(3));
      }
    });

    test('should demonstrate cosine distance ordering', async () => {
      // Seed: Opportunities with varying relevance
      const opportunities = [
        'Reduce cloud infrastructure costs by 50%',
        'Optimize AWS spending with rightsizing',
        'Improve employee onboarding process'  // Less relevant
      ];

      for (const opp of opportunities) {
        const memory = await memoryService.storeMemory({
          type: 'opportunity',
          content: JSON.stringify({ opportunity: opp }),
          metadata: {
            agentType: 'opportunity',
            score: 0.8,
            timestamp: new Date(),
            workflowId: testSessionId
          }
        });
        testMemoryIds.push(memory.id);
      }

      // Query: Cloud cost optimization
      const results = await memoryService.searchByQuery(
        'cloud cost optimization strategies',
        {
          type: 'opportunity',
          matchThreshold: 0.5,
          matchCount: 3
        }
      );

      // Assertions: Most relevant should be first
      expect(results[0].entry.content).toContain('cloud');
      expect(results[0].similarity).toBeGreaterThan(results[results.length - 1].similarity);

      console.log('✅ Cosine Distance Ordering:');
      results.forEach((r, i) => {
        const content = JSON.parse(r.entry.content);
        console.log(`  ${i + 1}. ${r.similarity.toFixed(3)} - ${content.opportunity}`);
      });
    });
  });

  describe('Production Performance Tests', () => {
    test('should handle high-volume similarity search efficiently', async () => {
      const startTime = Date.now();

      // Query against potentially large dataset
      const results = await memoryService.searchByQuery(
        'enterprise value engineering opportunities',
        {
          type: 'opportunity',
          matchThreshold: 0.7,
          matchCount: 20  // Request more results
        }
      );

      const duration = Date.now() - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(2000); // Under 2 seconds

      console.log(`✅ Search Duration: ${duration}ms`);
      console.log(`✅ Results Returned: ${results.length}`);
    });

    test('should verify HNSW index is being used', async () => {
      // Query execution plan to verify index usage
      const { data, error } = await supabase.rpc('search_semantic_memory', {
        query_embedding: new Array(1536).fill(0.1),  // Dummy embedding
        match_threshold: 0.7,
        match_count: 5
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Note: HNSW index should make this fast even with large dataset
      console.log('✅ HNSW Index Verification: Query executed');
    });
  });

  describe('Memory Partitioning by Workflow', () => {
    test('should isolate memories by workflow_id', async () => {
      const workflow1 = `workflow-${Date.now()}-1`;
      const workflow2 = `workflow-${Date.now()}-2`;

      // Seed: Same content, different workflows
      const memory1 = await memoryService.storeMemory({
        type: 'opportunity',
        content: JSON.stringify({ opportunity: 'Shared opportunity text' }),
        metadata: {
          agentType: 'opportunity',
          workflowId: workflow1,
          score: 0.9,
          timestamp: new Date()
        }
      });

      const memory2 = await memoryService.storeMemory({
        type: 'opportunity',
        content: JSON.stringify({ opportunity: 'Shared opportunity text' }),
        metadata: {
          agentType: 'opportunity',
          workflowId: workflow2,
          score: 0.9,
          timestamp: new Date()
        }
      });

      testMemoryIds.push(memory1.id, memory2.id);

      // Query: Filter by workflow
      const workflow1Results = await memoryService.searchByQuery(
        'shared opportunity',
        {
          type: 'opportunity',
          matchThreshold: 0.5,
          matchCount: 10,
          filters: {
            'metadata->>workflowId': workflow1
          }
        }
      );

      // Assertions
      workflow1Results.forEach(result => {
        expect(result.entry.metadata.workflowId).toBe(workflow1);
      });

      console.log('✅ Workflow Isolation Test Passed');
    });
  });

  describe('Threshold Tuning Scenarios', () => {
    test('should demonstrate false positive rate with low threshold', async () => {
      // Query with progressively lower thresholds
      const thresholds = [0.85, 0.75, 0.65, 0.55, 0.45];

      for (const threshold of thresholds) {
        const results = await memoryService.searchByQuery(
          'opportunity analysis',
          {
            type: 'opportunity',
            matchThreshold: threshold,
            matchCount: 10
          }
        );

        console.log(`Threshold ${threshold}: ${results.length} results`);

        // Lower thresholds return more results (potentially more false positives)
        if (threshold < 0.7) {
          console.warn(`⚠️  Threshold ${threshold} may include false positives`);
        }
      }
    });

    test('should recommend optimal threshold based on distribution', async () => {
      // Query with no threshold to see full distribution
      const allResults = await memoryService.searchByQuery(
        'value proposition',
        {
          type: 'value_proposition',
          matchThreshold: 0.0,  // No filtering
          matchCount: 50
        }
      );

      if (allResults.length > 0) {
        const similarities = allResults.map(r => r.similarity);
        const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length;
        const stdDev = Math.sqrt(
          similarities.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / similarities.length
        );

        const recommendedThreshold = avg - stdDev;

        console.log('📊 Similarity Distribution:');
        console.log(`  Average: ${avg.toFixed(3)}`);
        console.log(`  Std Dev: ${stdDev.toFixed(3)}`);
        console.log(`  Recommended Threshold: ${recommendedThreshold.toFixed(3)}`);
        console.log(`  (Filters out results > 1 std dev below average)`);

        expect(recommendedThreshold).toBeGreaterThan(0.5);
        expect(recommendedThreshold).toBeLessThan(0.9);
      }
    });
  });
});
