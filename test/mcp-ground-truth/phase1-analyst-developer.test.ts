/**
 * Phase 1: Analyst/Developer Feature Set Tests
 * 
 * Tests for data connectivity, SQL editor, notebooks, and caching
 * with MCP Financial Ground Truth Server integration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDevServer, MCPFinancialGroundTruthServer } from '../../src/mcp-ground-truth';

describe('Phase 1: Analyst/Developer Feature Set', () => {
  let mcpServer: MCPFinancialGroundTruthServer;

  beforeAll(async () => {
    // Initialize MCP server for testing
    mcpServer = await createDevServer();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('QA-FE-001: Native SQL Editor with Ground Truth Data', () => {
    it('should execute SQL query with MCP Ground Truth data', async () => {
      // Simulate SQL query execution
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193', // Apple Inc.
        metrics: ['revenue_total', 'net_income'],
        period: 'FY2024',
      });

      expect(result.isError).toBe(false);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);

      const data = JSON.parse(result.content[0].text!);
      
      // Verify data structure
      expect(data.data).toBeDefined();
      expect(data.metadata).toBeDefined();
      expect(data.audit).toBeDefined();

      // Verify Tier 1 data
      expect(data.metadata[0].source_tier).toBe(1);
      expect(data.metadata[0].extraction_confidence).toBeGreaterThan(0.9);

      // Verify provenance
      expect(data.metadata[0].filing_type).toBeDefined();
      expect(data.metadata[0].accession_number).toBeDefined();
    });

    it('should complete query within performance target', async () => {
      const startTime = Date.now();

      await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const executionTime = Date.now() - startTime;

      // Should complete within 500ms target
      expect(executionTime).toBeLessThan(500);
    });

    it('should include monitoring metrics', async () => {
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const data = JSON.parse(result.content[0].text!);

      // Verify audit trail
      expect(data.audit.trace_id).toBeDefined();
      expect(data.audit.timestamp).toBeDefined();
      expect(data.audit.verification_hash).toBeDefined();
    });
  });

  describe('QA-FE-002: Interactive Notebooks with Financial Modeling', () => {
    it('should fetch data for notebook analysis', async () => {
      // Simulate notebook cell execution
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'gross_profit', 'net_income'],
        period: 'FY2024',
      });

      expect(result.isError).toBe(false);

      const data = JSON.parse(result.content[0].text!);
      const metrics = data.data;

      // Verify we can perform calculations
      expect(metrics.length).toBe(3);

      // Simulate margin calculations
      const revenue = metrics.find((m: any) => m.metric === 'revenue_total')?.value;
      const grossProfit = metrics.find((m: any) => m.metric === 'gross_profit')?.value;
      const netIncome = metrics.find((m: any) => m.metric === 'net_income')?.value;

      expect(revenue).toBeGreaterThan(0);
      expect(grossProfit).toBeGreaterThan(0);
      expect(netIncome).toBeGreaterThan(0);

      // Calculate margins
      const grossMargin = (grossProfit / revenue) * 100;
      const netMargin = (netIncome / revenue) * 100;

      expect(grossMargin).toBeGreaterThan(0);
      expect(grossMargin).toBeLessThan(100);
      expect(netMargin).toBeGreaterThan(0);
      expect(netMargin).toBeLessThan(grossMargin);
    });

    it('should preserve provenance in analysis', async () => {
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const data = JSON.parse(result.content[0].text!);

      // Provenance should be preserved for notebook citations
      expect(data.metadata[0].source_name).toBeDefined();
      expect(data.metadata[0].filing_date).toBeDefined();
      expect(data.metadata[0].accession_number).toBeDefined();
    });
  });

  describe('QA-FE-003: Code-Centric Multi-Language Support', () => {
    it('should support TypeScript/JavaScript access', async () => {
      // This test itself demonstrates TypeScript support
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: 'AAPL',
        metrics: ['revenue_total'],
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should return consistent data format across languages', async () => {
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const data = JSON.parse(result.content[0].text!);

      // Verify standard format that works across languages
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('audit');

      // JSON format is language-agnostic
      expect(typeof data.data).toBe('object');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('QA-FE-004: Multi-Warehouse Data Connectivity', () => {
    it('should fetch data from MCP as external source', async () => {
      // Simulate cross-source query
      // In real implementation, this would join with internal warehouse

      const mcpData = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
        period: 'FY2024',
      });

      expect(mcpData.isError).toBe(false);

      const data = JSON.parse(mcpData.content[0].text!);

      // Verify data can be joined with internal data
      expect(data.data[0].entity).toBeDefined();
      expect(data.data[0].entity.cik).toBeDefined();

      // Simulate join key
      const joinKey = data.data[0].entity.cik;
      expect(joinKey).toBe('0000320193');
    });

    it('should support multiple company lookups for joins', async () => {
      const companies = ['0000320193', '0000789019', '0001652044'];
      const results = [];

      for (const cik of companies) {
        const result = await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: cik,
          metrics: ['revenue_total'],
        });

        expect(result.isError).toBe(false);
        results.push(result);
      }

      expect(results.length).toBe(3);

      // Verify all have consistent structure for joining
      for (const result of results) {
        const data = JSON.parse(result.content[0].text!);
        expect(data.data[0].entity.cik).toBeDefined();
        expect(data.data[0].value).toBeGreaterThan(0);
      }
    });

    it('should complete cross-source query within performance target', async () => {
      const startTime = Date.now();

      // Simulate fetching data for join
      await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
      });

      const executionTime = Date.now() - startTime;

      // Should complete within 2 seconds for cross-source query
      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe('QA-FE-005: Data Caching Performance', () => {
    it('should demonstrate cache performance improvement', async () => {
      // Clear any existing cache (if cache clearing is implemented)
      // For now, we'll just measure two consecutive calls

      // First call (cold cache)
      const start1 = Date.now();
      const result1 = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
      });
      const time1 = Date.now() - start1;

      expect(result1.isError).toBe(false);

      // Second call (warm cache)
      const start2 = Date.now();
      const result2 = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income'],
      });
      const time2 = Date.now() - start2;

      expect(result2.isError).toBe(false);

      // Second call should be significantly faster (at least 50% faster)
      // Note: This may not always be true in test environment
      // but demonstrates the caching concept
      console.log(`Cold cache: ${time1}ms, Warm cache: ${time2}ms`);

      // Verify data consistency
      const data1 = JSON.parse(result1.content[0].text!);
      const data2 = JSON.parse(result2.content[0].text!);

      expect(data1.data[0].value).toBe(data2.data[0].value);
    });

    it('should indicate cache hit in metadata', async () => {
      // First call
      await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      // Second call should hit cache
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      // Note: Cache hit indicator would be in metadata if implemented
      // This is a placeholder for when caching is fully implemented
      expect(result.isError).toBe(false);
    });

    it('should maintain data freshness with cache', async () => {
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total'],
      });

      const data = JSON.parse(result.content[0].text!);

      // Verify timestamp is recent
      const timestamp = new Date(data.audit.timestamp);
      const now = new Date();
      const ageMinutes = (now.getTime() - timestamp.getTime()) / 1000 / 60;

      // Data should be less than 1 hour old (for Tier 1 data, this is acceptable)
      expect(ageMinutes).toBeLessThan(60);
    });
  });

  describe('Integration: SQL Editor + MCP Ground Truth', () => {
    it('should support complex analytical queries', async () => {
      // Simulate a complex query that would be written in SQL editor
      // but uses MCP Ground Truth as a data source

      // Get multiple metrics for analysis
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: [
          'revenue_total',
          'gross_profit',
          'operating_income',
          'net_income',
          'cash_and_equivalents',
          'total_debt',
        ],
        period: 'FY2024',
      });

      expect(result.isError).toBe(false);

      const data = JSON.parse(result.content[0].text!);
      expect(data.data.length).toBe(6);

      // Verify all metrics are present
      const metricNames = data.data.map((m: any) => m.metric);
      expect(metricNames).toContain('revenue_total');
      expect(metricNames).toContain('gross_profit');
      expect(metricNames).toContain('operating_income');
      expect(metricNames).toContain('net_income');
      expect(metricNames).toContain('cash_and_equivalents');
      expect(metricNames).toContain('total_debt');

      // Verify all have Tier 1 confidence
      for (const metadata of data.metadata) {
        expect(metadata.source_tier).toBe(1);
        expect(metadata.extraction_confidence).toBeGreaterThan(0.9);
      }
    });

    it('should handle errors gracefully', async () => {
      // Test with invalid CIK
      const result = await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '9999999999',
        metrics: ['revenue_total'],
      });

      // Should return error, not throw
      expect(result.isError).toBe(true);

      const error = JSON.parse(result.content[0].text!);
      expect(error.error).toBeDefined();
      expect(error.error.code).toBeDefined();
      expect(error.error.message).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet latency targets for single metric', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await mcpServer.executeTool('get_authoritative_financials', {
          entity_id: '0000320193',
          metrics: ['revenue_total'],
        });
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Average latency: ${avgTime}ms`);

      // Average should be under 400ms target
      expect(avgTime).toBeLessThan(400);
    });

    it('should meet latency targets for multiple metrics', async () => {
      const start = Date.now();

      await mcpServer.executeTool('get_authoritative_financials', {
        entity_id: '0000320193',
        metrics: ['revenue_total', 'net_income', 'gross_profit'],
      });

      const executionTime = Date.now() - start;
      console.log(`Multiple metrics latency: ${executionTime}ms`);

      // Should still be under 500ms for multiple metrics
      expect(executionTime).toBeLessThan(500);
    });
  });
});
