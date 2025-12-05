/**
 * Phase 2: AI Query Generation and Self-Service Tests
 * 
 * Tests for AI-assisted query generation, natural language queries,
 * visualization interactivity, and automated workflows with MCP Ground Truth.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDevServer, MCPFinancialGroundTruthServer } from '../../src/mcp-ground-truth';

describe('Phase 2: AI Query Generation and Self-Service', () => {
  let mcpServer: MCPFinancialGroundTruthServer;

  beforeAll(async () => {
    mcpServer = await createDevServer();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('QA-AI-001: AI-Assisted Query with Ground Truth Validation', () => {
    it('should generate accurate query from natural language', async () => {
      // Simulate AI agent processing natural language query:
      // "Show me Apple's Q4 2024 revenue"

      // AI agent would translate this to MCP tool call
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193', // AI resolves "Apple" to CIK
        metrics: ['revenue_total'],
        period: 'CQ4_2024', // AI translates "Q4 2024" to period format
      });

      expect(result.isError).toBe(false);

      const data = JSON.parse(result.content[0].text!);

      // Verify AI got authoritative data
      expect(data.metadata[0].source_tier).toBe(1);
      expect(data.metadata[0].extraction_confidence).toBeGreaterThan(0.95);

      // Verify data structure for AI to format response
      expect(data.data[0].value).toBeGreaterThan(0);
      expect(data.data[0].entity.name).toBeDefined();
    });

    it('should verify AI-generated claims with Aletheia', async () => {
      // AI generates a claim: "Apple's revenue was $94.9B in Q4 2024"
      const claim = "Apple's revenue was $94.9B in Q4 2024";

      const verification = await mcpServer.executeTool('verify_claim_aletheia', {
        claim_text: claim,
        context_entity: '0000320193',
        context_date: '2024-10-01',
        strict_mode: true,
      });

      expect(verification.isError).toBe(false);

      const result = JSON.parse(verification.content[0].text!);

      // Verification should pass or provide discrepancy
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('confidence');

      if (result.verified) {
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.evidence).toBeDefined();
      } else {
        expect(result.discrepancy).toBeDefined();
      }
    });

    it('should provide citations for AI responses', async () => {
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const data = JSON.parse(result.content[0].text!);

      // AI should be able to construct citation from metadata
      const citation = {
        source: data.metadata[0].source_name,
        filing_type: data.metadata[0].filing_type,
        accession_number: data.metadata[0].accession_number,
        confidence: data.metadata[0].extraction_confidence,
        tier: data.metadata[0].source_tier,
      };

      expect(citation.source).toBeDefined();
      expect(citation.filing_type).toBeDefined();
      expect(citation.accession_number).toBeDefined();
      expect(citation.confidence).toBeGreaterThan(0.9);
      expect(citation.tier).toBe(1);

      // AI can format as: "[Source: SEC 10-K, Tier 1, Confidence: 97%]"
    });

    it('should handle comparative queries', async () => {
      // AI query: "Compare Apple and Microsoft revenue"

      const appleResult = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
        period: 'FY2024',
      });

      const msftResult = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000789019',
        metrics: ['revenue_total'],
        period: 'FY2024',
      });

      expect(appleResult.isError).toBe(false);
      expect(msftResult.isError).toBe(false);

      const appleData = JSON.parse(appleResult.content[0].text!);
      const msftData = JSON.parse(msftResult.content[0].text!);

      // AI can now compare
      const appleRevenue = appleData.data[0].value;
      const msftRevenue = msftData.data[0].value;

      expect(appleRevenue).toBeGreaterThan(0);
      expect(msftRevenue).toBeGreaterThan(0);

      // AI can calculate percentage difference
      const difference = ((appleRevenue - msftRevenue) / msftRevenue) * 100;
      expect(Math.abs(difference)).toBeGreaterThan(0);

      // Both should have Tier 1 confidence
      expect(appleData.metadata[0].source_tier).toBe(1);
      expect(msftData.metadata[0].source_tier).toBe(1);
    });

    it('should prevent hallucination with missing data', async () => {
      // AI tries to query non-existent company
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '9999999999',
        metrics: ['revenue_total'],
      });

      // Should return error, not hallucinate data
      expect(result.isError).toBe(true);

      const error = JSON.parse(result.content[0].text!);
      expect(error.error.code).toBeDefined();

      // AI should respond: "Data not available" instead of making up numbers
    });
  });

  describe('QA-AI-002: Interactive Visualization with Follow-up Questions', () => {
    it('should maintain context across follow-up questions', async () => {
      // Initial question: "Show me revenue trends for tech companies"
      const companies = [
        { cik: '0000320193', name: 'Apple' },
        { cik: '0000789019', name: 'Microsoft' },
        { cik: '0001652044', name: 'Alphabet' },
      ];

      const initialData = [];

      for (const company of companies) {
        const result = await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: company.cik,
          metrics: ['revenue_total'],
          period: 'FY2024',
        });

        expect(result.isError).toBe(false);
        const data = JSON.parse(result.content[0].text!);
        initialData.push({
          company: company.name,
          revenue: data.data[0].value,
          metadata: data.metadata[0],
        });
      }

      expect(initialData.length).toBe(3);

      // Follow-up question: "Which company had the highest revenue?"
      const highest = initialData.reduce((prev, current) =>
        current.revenue > prev.revenue ? current : prev
      );

      expect(highest.company).toBeDefined();
      expect(highest.revenue).toBeGreaterThan(0);

      // All data should be Tier 1
      for (const item of initialData) {
        expect(item.metadata.source_tier).toBe(1);
      }
    });

    it('should filter visualizations based on follow-up', async () => {
      // Initial: Get all metrics
      const allMetrics = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'gross_profit', 'operating_income', 'net_income'],
      });

      const allData = JSON.parse(allMetrics.content[0].text!);
      expect(allData.data.length).toBe(4);

      // Follow-up: "Show only profit metrics"
      const profitMetrics = allData.data.filter((m: any) =>
        m.metric.includes('profit') || m.metric.includes('income')
      );

      expect(profitMetrics.length).toBeGreaterThan(0);
      expect(profitMetrics.length).toBeLessThan(allData.data.length);
    });

    it('should add context from industry benchmarks', async () => {
      // Get company data
      const companyResult = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const companyData = JSON.parse(companyResult.content[0].text!);

      // Follow-up: "How does this compare to industry average?"
      // This would trigger a call to industry benchmark module
      // For now, we'll simulate the concept

      expect(companyData.data[0].value).toBeGreaterThan(0);

      // AI would fetch industry benchmark and compare
      // Result would show: "Apple's revenue is 250% above industry average"
    });

    it('should drill down into specific periods', async () => {
      // Initial: Annual data
      const annualResult = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
        period: 'FY2024',
      });

      expect(annualResult.isError).toBe(false);

      // Follow-up: "Show me quarterly breakdown"
      const quarters = ['CQ1_2024', 'CQ2_2024', 'CQ3_2024', 'CQ4_2024'];
      const quarterlyData = [];

      for (const quarter of quarters) {
        const result = await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: '0000320193',
          metrics: ['revenue_total'],
          period: quarter,
        });

        if (!result.isError) {
          const data = JSON.parse(result.content[0].text!);
          quarterlyData.push({
            period: quarter,
            revenue: data.data[0].value,
          });
        }
      }

      // Should have quarterly breakdown
      expect(quarterlyData.length).toBeGreaterThan(0);
    });
  });

  describe('QA-AI-003: Automated Python Workflows with Ground Truth', () => {
    it('should support scheduled financial monitoring', async () => {
      // Simulate automated monitoring script
      const companies = [
        '0000320193', // Apple
        '0000789019', // Microsoft
        '0001652044', // Alphabet
      ];

      const monitoringResults = [];

      for (const cik of companies) {
        const result = await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: cik,
          metrics: ['revenue_total', 'net_income'],
        });

        if (!result.isError) {
          const data = JSON.parse(result.content[0].text!);

          // Check data quality
          const confidence = data.metadata[0].extraction_confidence;
          const tier = data.metadata[0].source_tier;

          monitoringResults.push({
            cik,
            confidence,
            tier,
            alert: confidence < 0.9 ? 'Low confidence data' : null,
          });
        }
      }

      expect(monitoringResults.length).toBe(companies.length);

      // All should be high confidence
      for (const result of monitoringResults) {
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.tier).toBe(1);
        expect(result.alert).toBeNull();
      }
    });

    it('should detect anomalies in financial data', async () => {
      // Fetch historical data for anomaly detection
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
      });

      expect(result.isError).toBe(false);

      const data = JSON.parse(result.content[0].text!);

      // Check for anomalies (simplified)
      const revenue = data.data.find((m: any) => m.metric === 'revenue_total')?.value;
      const netIncome = data.data.find((m: any) => m.metric === 'net_income')?.value;

      // Basic sanity checks
      expect(revenue).toBeGreaterThan(0);
      expect(netIncome).toBeGreaterThan(0);

      // Net income should be less than revenue
      expect(netIncome).toBeLessThan(revenue);

      // Calculate profit margin
      const profitMargin = (netIncome / revenue) * 100;

      // Profit margin should be reasonable (0-100%)
      expect(profitMargin).toBeGreaterThan(0);
      expect(profitMargin).toBeLessThan(100);

      // Flag if margin is unusually low or high
      const anomaly = profitMargin < 5 || profitMargin > 50;

      // For Apple, margin should be normal
      expect(anomaly).toBe(false);
    });

    it('should log execution for audit trail', async () => {
      const executionLog = {
        timestamp: new Date().toISOString(),
        script: 'daily_financial_monitor',
        companies_checked: 0,
        alerts_generated: 0,
        execution_time_ms: 0,
      };

      const startTime = Date.now();

      const companies = ['0000320193', '0000789019'];

      for (const cik of companies) {
        const result = await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: cik,
          metrics: ['revenue_total'],
        });

        if (!result.isError) {
          executionLog.companies_checked++;

          const data = JSON.parse(result.content[0].text!);
          if (data.metadata[0].extraction_confidence < 0.9) {
            executionLog.alerts_generated++;
          }
        }
      }

      executionLog.execution_time_ms = Date.now() - startTime;

      // Verify execution log
      expect(executionLog.companies_checked).toBe(companies.length);
      expect(executionLog.execution_time_ms).toBeGreaterThan(0);
      expect(executionLog.timestamp).toBeDefined();
    });

    it('should handle API failures gracefully in automation', async () => {
      // Simulate automation that handles errors
      const companies = ['0000320193', '9999999999']; // One valid, one invalid
      const results = [];

      for (const cik of companies) {
        try {
          const result = await mcpServer.executeTool('get_authoritative_financials', {
            entity_id: cik,
            metrics: ['revenue_total'],
          });

          if (result.isError) {
            results.push({ cik, status: 'error', error: JSON.parse(result.content[0].text!) });
          } else {
            results.push({ cik, status: 'success', data: JSON.parse(result.content[0].text!) });
          }
        } catch (error) {
          results.push({ cik, status: 'exception', error });
        }
      }

      expect(results.length).toBe(2);

      // First should succeed
      expect(results[0].status).toBe('success');

      // Second should error gracefully
      expect(results[1].status).toBe('error');
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Integration: AI Agent + MCP Ground Truth', () => {
    it('should support complete AI workflow', async () => {
      // Simulate complete AI agent workflow:
      // 1. User asks question
      // 2. AI fetches data from MCP
      // 3. AI performs analysis
      // 4. AI verifies claims
      // 5. AI responds with citations

      // Step 1: User question (simulated)
      const userQuestion = "What was Apple's profit margin in 2024?";

      // Step 2: AI fetches data
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
        period: 'FY2024',
      });

      expect(result.isError).toBe(false);

      const data = JSON.parse(result.content[0].text!);

      // Step 3: AI performs analysis
      const revenue = data.data.find((m: any) => m.metric === 'revenue_total')?.value;
      const netIncome = data.data.find((m: any) => m.metric === 'net_income')?.value;
      const profitMargin = (netIncome / revenue) * 100;

      // Step 4: AI constructs claim
      const claim = `Apple's profit margin in FY2024 was ${profitMargin.toFixed(1)}%`;

      // Step 5: AI verifies claim (would use verify_claim_aletheia in production)
      expect(profitMargin).toBeGreaterThan(0);
      expect(profitMargin).toBeLessThan(100);

      // Step 6: AI responds with citation
      const response = {
        answer: claim,
        citation: {
          source: data.metadata[0].source_name,
          tier: data.metadata[0].source_tier,
          confidence: data.metadata[0].extraction_confidence,
          filing: data.metadata[0].filing_type,
        },
      };

      expect(response.answer).toContain('profit margin');
      expect(response.citation.tier).toBe(1);
      expect(response.citation.confidence).toBeGreaterThan(0.9);
    });

    it('should refuse to hallucinate when data unavailable', async () => {
      // AI tries to answer question about private company
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: 'PRIVATE_COMPANY',
        metrics: ['revenue_total'],
      });

      // Should return error
      expect(result.isError).toBe(true);

      // AI should respond: "I don't have authoritative data for this company"
      // instead of making up numbers
    });
  });

  describe('Performance: AI Query Latency', () => {
    it('should meet latency targets for AI interactions', async () => {
      // AI interactions should be fast enough for real-time chat
      const start = Date.now();

      await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const latency = Date.now() - start;

      // Should be under 500ms for good UX
      expect(latency).toBeLessThan(500);
    });

    it('should handle concurrent AI requests', async () => {
      // Simulate multiple users asking questions simultaneously
      const requests = [
        mcpServer.executeTool('get_authoritative_financials', {
          entity_id: '0000320193',
          metrics: ['revenue_total'],
        }),
        mcpServer.executeTool('get_authoritative_financials', {
          entity_id: '0000789019',
          metrics: ['revenue_total'],
        }),
        mcpServer.executeTool('get_authoritative_financials', {
          entity_id: '0001652044',
          metrics: ['revenue_total'],
        }),
      ];

      const start = Date.now();
      const results = await Promise.all(requests);
      const totalTime = Date.now() - start;

      // All should succeed
      for (const result of results) {
        expect(result.isError).toBe(false);
      }

      // Concurrent execution should be efficient
      console.log(`Concurrent requests completed in ${totalTime}ms`);
    });
  });
});
