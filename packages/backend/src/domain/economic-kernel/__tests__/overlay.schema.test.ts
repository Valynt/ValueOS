import { describe, expect, it } from 'vitest';

import { METRIC_IDS } from '../kpi_registry';
import {
  DomainOverlaySchema,
  safeValidateOverlay,
  validateOverlay,
  validateOverlayConsistency,
} from '../overlay.schema';
import type { DomainOverlay } from '../overlay.schema';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_OVERLAY: DomainOverlay = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'banking-v1',
  version: '1.0.0',
  appliesTo: [
    METRIC_IDS.NET_PRESENT_VALUE,
    METRIC_IDS.INTERNAL_RATE_OF_RETURN,
    METRIC_IDS.DISCOUNT_RATE,
  ],
  kpiOverrides: [
    {
      metricId: METRIC_IDS.NET_PRESENT_VALUE,
      displayName: 'Risk-Adjusted NPV',
      tags: ['banking', 'capital-markets'],
    },
  ],
  financialDefaults: {
    defaultDiscountRate: 0.08,
    discountRateJustification: 'Based on weighted average cost of capital for US commercial banks',
    defaultTimeHorizonYears: 5,
    defaultCurrency: 'USD',
    costOfCapital: 0.065,
  },
  riskModelOverrides: [
    {
      categoryId: 'regulatory-risk',
      categoryName: 'Regulatory Risk',
      defaultWeight: 0.3,
      factors: [
        { id: 'capital-adequacy', name: 'Capital Adequacy', defaultScore: 0.2, weight: 0.5 },
        { id: 'compliance-burden', name: 'Compliance Burden', defaultScore: 0.3, weight: 0.5 },
      ],
    },
  ],
  benchmarks: [
    {
      metricId: METRIC_IDS.DISCOUNT_RATE,
      source: 'Federal Reserve',
      sourceUrl: 'https://www.federalreserve.gov/data.htm',
      dataDate: '2026-01-15T00:00:00Z',
      refreshCadenceDays: 90,
      percentiles: { p25: 0.06, p50: 0.08, p75: 0.10, p90: 0.12 },
      sampleSize: 500,
      confidenceLevel: 'high',
      segment: 'US Commercial Banks',
    },
  ],
  narrative: {
    terminology: {
      revenue_uplift: 'NIM Expansion',
      cost_reduction: 'Operational Efficiency',
    },
    reportSections: [
      { id: 'capital-impact', title: 'Capital Impact Analysis', templateKey: 'banking.capital_impact' },
    ],
  },
  governance: {
    regulated: true,
    regulatoryFrameworks: ['Basel III', 'Dodd-Frank'],
    requiredApprovalRoles: ['risk-officer', 'compliance-officer'],
    limitationStatements: [
      'Model outputs are estimates and should not replace regulatory capital calculations.',
    ],
    effectiveDate: '2026-02-01T00:00:00Z',
    citations: [
      {
        claim: 'Default discount rate of 8%',
        source: 'Federal Reserve Economic Data',
        url: 'https://fred.stlouisfed.org/',
        date: '2026-01',
      },
    ],
  },
};

// ─── Schema Validation Tests ─────────────────────────────────────────────────

describe('DomainOverlaySchema', () => {
  it('validates a complete overlay', () => {
    expect(() => validateOverlay(VALID_OVERLAY)).not.toThrow();
  });

  it('rejects missing id', () => {
    const { id: _, ...noId } = VALID_OVERLAY;
    const result = safeValidateOverlay(noId);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID id', () => {
    const result = safeValidateOverlay({ ...VALID_OVERLAY, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects non-kebab-case name', () => {
    const result = safeValidateOverlay({ ...VALID_OVERLAY, name: 'Banking V1' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid semver', () => {
    const result = safeValidateOverlay({ ...VALID_OVERLAY, version: 'v1' });
    expect(result.success).toBe(false);
  });

  it('rejects empty appliesTo', () => {
    const result = safeValidateOverlay({ ...VALID_OVERLAY, appliesTo: [] });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID in appliesTo', () => {
    const result = safeValidateOverlay({ ...VALID_OVERLAY, appliesTo: ['not-uuid'] });
    expect(result.success).toBe(false);
  });

  it('accepts minimal overlay (only required fields)', () => {
    const minimal = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'minimal-pack',
      version: '0.1.0',
      appliesTo: [METRIC_IDS.NET_PRESENT_VALUE],
    };
    expect(() => validateOverlay(minimal)).not.toThrow();
  });
});

describe('FinancialProfile validation', () => {
  it('rejects discount rate > 1', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      financialDefaults: { defaultDiscountRate: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative discount rate', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      financialDefaults: { defaultDiscountRate: -0.1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO currency code', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      financialDefaults: { defaultCurrency: 'US' },
    });
    expect(result.success).toBe(false);
  });
});

describe('RiskOverride validation', () => {
  it('rejects weight > 1', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      riskModelOverrides: [{
        categoryId: 'test',
        categoryName: 'Test',
        defaultWeight: 1.5,
        factors: [],
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects factor score > 1', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      riskModelOverrides: [{
        categoryId: 'test',
        categoryName: 'Test',
        defaultWeight: 0.5,
        factors: [{ id: 'f1', name: 'Factor', defaultScore: 2.0, weight: 0.5 }],
      }],
    });
    expect(result.success).toBe(false);
  });
});

describe('BenchmarkSource validation', () => {
  it('rejects non-UUID metricId', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      benchmarks: [{
        metricId: 'not-uuid',
        source: 'Test',
        dataDate: '2026-01-01T00:00:00Z',
        percentiles: { p50: 100 },
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid dataDate', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      benchmarks: [{
        metricId: METRIC_IDS.NET_PRESENT_VALUE,
        source: 'Test',
        dataDate: 'not-a-date',
        percentiles: { p50: 100 },
      }],
    });
    expect(result.success).toBe(false);
  });
});

describe('GovernanceMetadata validation', () => {
  it('accepts non-regulated overlay without frameworks', () => {
    const overlay = {
      ...VALID_OVERLAY,
      governance: { regulated: false },
    };
    expect(() => validateOverlay(overlay)).not.toThrow();
  });

  it('validates citation URLs', () => {
    const result = safeValidateOverlay({
      ...VALID_OVERLAY,
      governance: {
        regulated: false,
        citations: [{ claim: 'test', source: 'test', url: 'not-a-url' }],
      },
    });
    expect(result.success).toBe(false);
  });
});

// ─── Consistency Validation Tests ────────────────────────────────────────────

describe('validateOverlayConsistency', () => {
  it('returns no errors for consistent overlay', () => {
    const errors = validateOverlayConsistency(VALID_OVERLAY);
    expect(errors).toHaveLength(0);
  });

  it('detects KPI override referencing metric not in appliesTo', () => {
    const overlay: DomainOverlay = {
      ...VALID_OVERLAY,
      kpiOverrides: [
        { metricId: METRIC_IDS.CHURN_RATE, displayName: 'Attrition Rate' },
      ],
    };
    const errors = validateOverlayConsistency(overlay);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('not in appliesTo');
  });

  it('detects benchmark referencing metric not in appliesTo', () => {
    const overlay: DomainOverlay = {
      ...VALID_OVERLAY,
      benchmarks: [
        {
          metricId: METRIC_IDS.CHURN_RATE,
          source: 'Test',
          dataDate: '2026-01-01T00:00:00Z',
          percentiles: { p50: 5 },
        },
      ],
    };
    const errors = validateOverlayConsistency(overlay);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('not in appliesTo');
  });

  it('detects regulated overlay without regulatory frameworks', () => {
    const overlay: DomainOverlay = {
      ...VALID_OVERLAY,
      governance: { regulated: true },
    };
    const errors = validateOverlayConsistency(overlay);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('regulatory framework');
  });

  it('passes for regulated overlay with frameworks', () => {
    const overlay: DomainOverlay = {
      ...VALID_OVERLAY,
      governance: { regulated: true, regulatoryFrameworks: ['SOX'] },
    };
    const errors = validateOverlayConsistency(overlay);
    expect(errors).toHaveLength(0);
  });
});
