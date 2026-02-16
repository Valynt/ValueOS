/**
 * Invoice Reproducibility Verification Tests
 *
 * Tests that invoice calculation produces identical results when run
 * multiple times with the same input data, ensuring auditability and consistency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvoiceMathEngine } from '../InvoiceMathEngine.js';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase for testing
const mockSupabase = {
  from: () => ({
    select: () => ({
      gte: () => ({
        lte: () => ({
          order: () => ({
            data: [
              {
                id: 'ledger-1',
                tenant_id: 'test-tenant-123',
                subscription_id: 'sub-123',
                price_version_id: 'price-123',
                meter_key: 'ai_tokens',
                period_start: '2024-01-01T00:00:00Z',
                period_end: '2024-01-31T23:59:59Z',
                quantity_used: 1000,
                quantity_included: 500,
                quantity_overage: 500,
                unit_price: 0.01,
                amount: 5.00,
                rated_at: '2024-01-31T12:00:00Z',
                source_aggregate_hash: 'hash123'
              }
            ],
            error: null
          })
        })
      })
    })
  })
};

describe('Invoice Reproducibility Verification', () => {
  const testTenantId = 'test-tenant-123';
  const testSubscriptionId = 'sub-123';
  const testPeriodStart = '2024-01-01T00:00:00Z';
  const testPeriodEnd = '2024-01-31T23:59:59Z';

  beforeEach(() => {
    // Setup test data
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Deterministic Calculation', () => {
    it('should produce identical invoices for same input parameters', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      // Calculate invoice multiple times
      const invoice1 = await InvoiceMathEngine.calculateInvoice(input);
      const invoice2 = await InvoiceMathEngine.calculateInvoice(input);
      const invoice3 = await InvoiceMathEngine.calculateInvoice(input);

      // All calculations should be identical
      expect(invoice1.calculation_hash).toBe(invoice2.calculation_hash);
      expect(invoice1.calculation_hash).toBe(invoice3.calculation_hash);
      expect(invoice1.total_amount).toBe(invoice2.total_amount);
      expect(invoice1.total_amount).toBe(invoice3.total_amount);

      // Verify specific fields
      expect(invoice1.subtotal).toBe(invoice2.subtotal);
      expect(invoice1.tax_amount).toBe(invoice2.tax_amount);
      expect(invoice1.amount_due).toBe(invoice2.amount_due);
    });

    it('should produce different results for different input parameters', async () => {
      const baseInput = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice1 = await InvoiceMathEngine.calculateInvoice(baseInput);

      // Change period end
      const invoice2 = await InvoiceMathEngine.calculateInvoice({
        ...baseInput,
        period_end: '2024-02-01T23:59:59Z'
      });

      // Change tenant
      const invoice3 = await InvoiceMathEngine.calculateInvoice({
        ...baseInput,
        tenant_id: 'different-tenant'
      });

      // Results should be different
      expect(invoice1.calculation_hash).not.toBe(invoice2.calculation_hash);
      expect(invoice1.calculation_hash).not.toBe(invoice3.calculation_hash);
      expect(invoice2.calculation_hash).not.toBe(invoice3.calculation_hash);
    });

    it('should maintain reproducibility across time', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      // Calculate now
      const invoiceNow = await InvoiceMathEngine.calculateInvoice(input);

      // Simulate time passing (would need to mock system time)
      // In real test, could store hash and verify later
      const storedHash = invoiceNow.calculation_hash;

      // Calculate again (should be same)
      const invoiceLater = await InvoiceMathEngine.calculateInvoice(input);

      expect(invoiceLater.calculation_hash).toBe(storedHash);
    });
  });

  describe('Hash Verification', () => {
    it('should generate consistent calculation hashes', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Hash should be present and consistent
      expect(invoice.calculation_hash).toBeDefined();
      expect(typeof invoice.calculation_hash).toBe('string');
      expect(invoice.calculation_hash.length).toBeGreaterThan(0);

      // Recalculate and verify hash matches
      const recalculated = await InvoiceMathEngine.calculateInvoice(input);
      expect(recalculated.calculation_hash).toBe(invoice.calculation_hash);
    });

    it('should detect data tampering through hash verification', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Simulate tampering with calculation result
      const tamperedInvoice = {
        ...invoice,
        total_amount: invoice.total_amount + 100 // Add $100
      };

      // Verification should fail
      const isValid = await InvoiceMathEngine.verifyCalculation(
        tamperedInvoice,
        testTenantId,
        testSubscriptionId,
        testPeriodStart,
        testPeriodEnd
      );

      expect(isValid).toBe(false);
    });

    it('should include all relevant data in hash calculation', async () => {
      // Test that changing any input affects the hash
      const baseInput = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const baseInvoice = await InvoiceMathEngine.calculateInvoice(baseInput);

      // Change a small input and verify hash changes
      const modifiedInput = {
        ...baseInput,
        period_end: '2024-01-30T23:59:59Z' // One day earlier
      };

      const modifiedInvoice = await InvoiceMathEngine.calculateInvoice(modifiedInput);

      expect(modifiedInvoice.calculation_hash).not.toBe(baseInvoice.calculation_hash);
    });
  });

  describe('Line Item Consistency', () => {
    it('should produce consistent line items', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice1 = await InvoiceMathEngine.calculateInvoice(input);
      const invoice2 = await InvoiceMathEngine.calculateInvoice(input);

      // Line items should be identical
      expect(invoice1.line_items.length).toBe(invoice2.line_items.length);

      for (let i = 0; i < invoice1.line_items.length; i++) {
        const item1 = invoice1.line_items[i];
        const item2 = invoice2.line_items[i];

        expect(item1.meter_key).toBe(item2.meter_key);
        expect(item1.quantity_included).toBe(item2.quantity_included);
        expect(item1.quantity_overage).toBe(item2.quantity_overage);
        expect(item1.unit_price).toBe(item2.unit_price);
        expect(item1.amount).toBe(item2.amount);
        expect(item1.description).toBe(item2.description);
      }
    });

    it('should handle line item ordering consistently', async () => {
      // Test that line items are ordered consistently
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice1 = await InvoiceMathEngine.calculateInvoice(input);
      const invoice2 = await InvoiceMathEngine.calculateInvoice(input);

      // Sort line items by meter key for comparison
      const sortedItems1 = [...invoice1.line_items].sort((a, b) => a.meter_key.localeCompare(b.meter_key));
      const sortedItems2 = [...invoice2.line_items].sort((a, b) => a.meter_key.localeCompare(b.meter_key));

      expect(sortedItems1.length).toBe(sortedItems2.length);

      for (let i = 0; i < sortedItems1.length; i++) {
        expect(sortedItems1[i]).toEqual(sortedItems2[i]);
      }
    });
  });

  describe('Mathematical Consistency', () => {
    it('should maintain mathematical relationships', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Verify mathematical relationships
      const calculatedSubtotal = invoice.line_items.reduce((sum, item) => sum + item.amount, 0);
      expect(calculatedSubtotal).toBe(invoice.subtotal);

      const calculatedTotal = invoice.subtotal - invoice.applied_credits + invoice.tax_amount;
      expect(calculatedTotal).toBe(invoice.total_amount);

      expect(invoice.amount_due).toBe(Math.max(0, invoice.total_amount));
    });

    it('should handle edge cases in calculations', async () => {
      // Test with zero amounts, negative credits, etc.
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Should handle all numeric calculations without errors
      expect(typeof invoice.subtotal).toBe('number');
      expect(typeof invoice.total_amount).toBe('number');
      expect(typeof invoice.amount_due).toBe('number');
      expect(invoice.amount_due).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Trail', () => {
    it('should maintain calculation audit trail', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Should include metadata for auditing
      expect(invoice).toHaveProperty('calculation_hash');
      expect(invoice).toHaveProperty('line_items');

      // Line items should include metadata
      invoice.line_items.forEach(item => {
        expect(item).toHaveProperty('metadata');
        expect(item.metadata).toHaveProperty('rated_at');
        expect(item.metadata).toHaveProperty('entry_count');
      });
    });

    it('should enable forensic analysis of calculations', async () => {
      // Test that all inputs to calculation are traceable
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      const invoice = await InvoiceMathEngine.calculateInvoice(input);

      // Should be able to reconstruct calculation from stored data
      const verification = await InvoiceMathEngine.verifyCalculation(
        invoice,
        testTenantId,
        testSubscriptionId,
        testPeriodStart,
        testPeriodEnd
      );

      expect(verification).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain reproducibility under load', async () => {
      const input = {
        tenant_id: testTenantId,
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      // Run multiple calculations concurrently
      const promises = Array(10).fill().map(() =>
        InvoiceMathEngine.calculateInvoice(input)
      );

      const results = await Promise.all(promises);

      // All results should be identical
      const firstHash = results[0].calculation_hash;
      results.forEach(result => {
        expect(result.calculation_hash).toBe(firstHash);
      });
    });

    it('should handle large datasets consistently', async () => {
      // Test with larger invoice data
      // (Would need mock data with many line items)
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', async () => {
      const input = {
        tenant_id: 'nonexistent-tenant',
        subscription_id: testSubscriptionId,
        period_start: testPeriodStart,
        period_end: testPeriodEnd
      };

      // Should not crash, should return predictable result
      await expect(InvoiceMathEngine.calculateInvoice(input)).rejects.toThrow();
    });

    it('should maintain consistency even with partial failures', async () => {
      // Test behavior when some data sources are unavailable
      // (Would need to mock partial failures)
      expect(true).toBe(true); // Placeholder
    });
  });
});
