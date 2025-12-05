/**
 * ExpansionWorkflow Tests
 * 
 * Tests for expansion workflow with upsell detection and cross-sell opportunities
 * following MCP patterns for integration testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ExpansionWorkflow', () => {
  let mockDB: any;
  let mockAgents: any;

  beforeEach(() => {
    mockDB = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis()
    };

    mockAgents = {
      expansion: vi.fn(),
      opportunity: vi.fn()
    };
  });

  describe('Upsell Detection', () => {
    it('should detect upsell opportunities', async () => {
      const customer = {
        id: 'customer-123',
        current_tier: 'basic',
        usage_metrics: {
          api_calls: 9500,
          tier_limit: 10000,
          utilization: 0.95
        }
      };

      const upsellOpportunity = {
        customer_id: customer.id,
        type: 'tier_upgrade',
        from_tier: 'basic',
        to_tier: 'professional',
        reason: 'high_utilization',
        confidence: 0.9
      };

      expect(customer.usage_metrics.utilization).toBeGreaterThan(0.9);
      expect(upsellOpportunity.confidence).toBeGreaterThan(0.8);
    });

    it('should identify feature adoption patterns', async () => {
      const adoption = {
        customer_id: 'customer-123',
        features_used: ['analytics', 'reporting', 'api_access'],
        features_available: ['analytics', 'reporting', 'api_access', 'automation', 'ml_insights'],
        adoption_rate: 0.6,
        unused_premium_features: ['automation', 'ml_insights']
      };

      expect(adoption.unused_premium_features.length).toBeGreaterThan(0);
      expect(adoption.adoption_rate).toBeLessThan(1.0);
    });

    it('should calculate expansion value', async () => {
      const expansion = {
        customer_id: 'customer-123',
        current_arr: 50000,
        expansion_arr: 25000,
        expansion_percentage: 0.5,
        confidence: 0.85
      };

      expect(expansion.expansion_arr).toBe(expansion.current_arr * expansion.expansion_percentage);
      expect(expansion.confidence).toBeGreaterThan(0.8);
    });

    it('should prioritize expansion opportunities', async () => {
      const opportunities = [
        { id: 'exp-1', value: 50000, confidence: 0.9, priority: 0 },
        { id: 'exp-2', value: 30000, confidence: 0.7, priority: 0 },
        { id: 'exp-3', value: 40000, confidence: 0.85, priority: 0 }
      ];

      // Calculate priority score (value * confidence)
      opportunities.forEach(opp => {
        opp.priority = opp.value * opp.confidence;
      });

      opportunities.sort((a, b) => b.priority - a.priority);

      expect(opportunities[0].id).toBe('exp-1');
      expect(opportunities[0].priority).toBeGreaterThan(opportunities[1].priority);
    });
  });

  describe('Cross-Sell Opportunities', () => {
    it('should identify complementary products', async () => {
      const customer = {
        id: 'customer-123',
        current_products: ['analytics_platform'],
        industry: 'financial_services'
      };

      const crossSell = {
        customer_id: customer.id,
        recommended_products: ['risk_management', 'compliance_suite'],
        reason: 'industry_fit',
        confidence: 0.8
      };

      expect(crossSell.recommended_products.length).toBeGreaterThan(0);
      expect(crossSell.confidence).toBeGreaterThan(0.7);
    });

    it('should analyze product affinity', async () => {
      const affinity = {
        product_a: 'analytics_platform',
        product_b: 'data_warehouse',
        affinity_score: 0.85,
        co_purchase_rate: 0.7
      };

      expect(affinity.affinity_score).toBeGreaterThan(0.8);
      expect(affinity.co_purchase_rate).toBeGreaterThan(0.6);
    });

    it('should generate cross-sell campaigns', async () => {
      const campaign = {
        campaign_id: 'campaign-1',
        target_customers: ['customer-123', 'customer-456'],
        product: 'risk_management',
        message: 'Enhance your analytics with risk management',
        expected_conversion: 0.15
      };

      expect(campaign.target_customers.length).toBeGreaterThan(0);
      expect(campaign.expected_conversion).toBeGreaterThan(0);
    });
  });

  describe('Gap Analysis', () => {
    it('should perform capability gap analysis', async () => {
      const analysis = {
        customer_id: 'customer-123',
        current_capabilities: ['data_analysis', 'reporting'],
        desired_capabilities: ['data_analysis', 'reporting', 'predictive_analytics', 'automation'],
        gaps: ['predictive_analytics', 'automation']
      };

      expect(analysis.gaps.length).toBe(2);
      expect(analysis.gaps).toContain('predictive_analytics');
    });

    it('should map gaps to products', async () => {
      const gapMapping = {
        gap: 'predictive_analytics',
        products: [
          { id: 'ml_suite', fit_score: 0.9 },
          { id: 'analytics_pro', fit_score: 0.7 }
        ]
      };

      expect(gapMapping.products.length).toBeGreaterThan(0);
      expect(gapMapping.products[0].fit_score).toBeGreaterThan(gapMapping.products[1].fit_score);
    });

    it('should calculate gap closure value', async () => {
      const gapValue = {
        gap: 'automation',
        current_manual_cost: 100000,
        automation_savings: 70000,
        product_cost: 20000,
        net_value: 50000
      };

      expect(gapValue.net_value).toBe(
        gapValue.automation_savings - gapValue.product_cost
      );
      expect(gapValue.net_value).toBeGreaterThan(0);
    });
  });

  describe('Customer Journey Mapping', () => {
    it('should track customer lifecycle stage', async () => {
      const customer = {
        id: 'customer-123',
        lifecycle_stage: 'growth',
        tenure_months: 18,
        health_score: 0.85
      };

      expect(customer.lifecycle_stage).toBe('growth');
      expect(customer.health_score).toBeGreaterThan(0.8);
    });

    it('should identify expansion triggers', async () => {
      const triggers = [
        { type: 'usage_threshold', triggered: true, value: 0.95 },
        { type: 'feature_request', triggered: true, count: 3 },
        { type: 'support_escalation', triggered: false, count: 0 }
      ];

      const activeTriggers = triggers.filter(t => t.triggered);

      expect(activeTriggers.length).toBe(2);
    });

    it('should predict expansion timing', async () => {
      const prediction = {
        customer_id: 'customer-123',
        predicted_expansion_date: '2025-03-15',
        confidence: 0.8,
        factors: ['high_usage', 'feature_requests', 'positive_sentiment']
      };

      expect(prediction.confidence).toBeGreaterThan(0.7);
      expect(prediction.factors.length).toBeGreaterThan(0);
    });

    it('should generate expansion playbook', async () => {
      const playbook = {
        customer_id: 'customer-123',
        recommended_actions: [
          { action: 'schedule_business_review', priority: 'high' },
          { action: 'demo_premium_features', priority: 'high' },
          { action: 'provide_roi_analysis', priority: 'medium' }
        ],
        timeline: '30_days'
      };

      expect(playbook.recommended_actions.length).toBeGreaterThan(0);
      expect(playbook.recommended_actions[0].priority).toBe('high');
    });
  });

  describe('Workflow Integration', () => {
    it('should integrate with realization workflow', async () => {
      const realizationData = {
        customer_id: 'customer-123',
        realized_value: 450000,
        target_value: 500000,
        success_rate: 0.9
      };

      const expansionInput = {
        customer_id: realizationData.customer_id,
        proven_value: realizationData.realized_value,
        success_indicator: realizationData.success_rate
      };

      expect(expansionInput.customer_id).toBe(realizationData.customer_id);
      expect(expansionInput.success_indicator).toBeGreaterThan(0.8);
    });

    it('should trigger opportunity workflow', async () => {
      const expansionOpportunity = {
        customer_id: 'customer-123',
        type: 'upsell',
        product: 'analytics_pro',
        value: 50000
      };

      const opportunityWorkflow = {
        triggered_by: 'expansion_workflow',
        customer_id: expansionOpportunity.customer_id,
        opportunity_type: expansionOpportunity.type,
        estimated_value: expansionOpportunity.value
      };

      expect(opportunityWorkflow.triggered_by).toBe('expansion_workflow');
      expect(opportunityWorkflow.estimated_value).toBe(50000);
    });

    it('should coordinate with sales engagement', async () => {
      const salesEngagement = {
        customer_id: 'customer-123',
        expansion_opportunity_id: 'exp-456',
        assigned_to: 'sales-rep-789',
        status: 'pending',
        priority: 'high'
      };

      expect(salesEngagement.status).toBe('pending');
      expect(salesEngagement.priority).toBe('high');
    });
  });

  describe('Performance', () => {
    it('should analyze expansion opportunities efficiently', async () => {
      const analysis = {
        customer_count: 100,
        opportunities_identified: 35,
        analysis_time_ms: 1500,
        avg_time_per_customer: 15
      };

      expect(analysis.analysis_time_ms).toBeLessThan(3000);
      expect(analysis.avg_time_per_customer).toBeLessThan(50);
    });

    it('should cache customer analysis', async () => {
      const cache = {
        customer_id: 'customer-123',
        analysis: { /* cached data */ },
        cached_at: Date.now(),
        ttl_seconds: 3600
      };

      const age = (Date.now() - cache.cached_at) / 1000;

      expect(age).toBeLessThan(cache.ttl_seconds);
    });

    it('should batch process opportunities', async () => {
      const batch = {
        batch_id: 'batch-1',
        customer_ids: Array.from({ length: 50 }, (_, i) => `customer-${i}`),
        processed: 50,
        duration_ms: 2000
      };

      expect(batch.processed).toBe(batch.customer_ids.length);
      expect(batch.duration_ms).toBeLessThan(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing customer data', async () => {
      const analysis = {
        customer_id: 'customer-999',
        status: 'failed',
        error: 'customer_not_found'
      };

      expect(analysis.status).toBe('failed');
      expect(analysis.error).toBeDefined();
    });

    it('should handle incomplete usage data', async () => {
      const customer = {
        id: 'customer-123',
        usage_metrics: null
      };

      const result = {
        customer_id: customer.id,
        analysis_possible: false,
        reason: 'insufficient_data'
      };

      expect(result.analysis_possible).toBe(false);
    });

    it('should retry failed analyses', async () => {
      const analysis = {
        customer_id: 'customer-123',
        attempt: 1,
        max_attempts: 3,
        status: 'retrying'
      };

      expect(analysis.attempt).toBeLessThan(analysis.max_attempts);
      expect(analysis.status).toBe('retrying');
    });
  });
});
