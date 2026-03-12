import { describe, expect, it } from 'vitest';

import { deriveKpis } from '../adapters/kpiTarget.derived';

describe('deriveKpis', () => {
  it('derives unit and timeframe from explicit kpiHints first', () => {
    const results = deriveKpis(
      {
        outputs: { revenue_growth: 12 },
        kpiHints: {
          revenue_growth: {
            unit: '%',
            timeframe: 'Q4-2026',
          },
        },
      },
      {}
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      metric: 'revenue_growth',
      unit: '%',
      timeframe: 'Q4-2026',
    });
  });

  it('falls back to tree metadata and then inference/defaults', () => {
    const fromTree = deriveKpis(
      {
        outputs: { churn_rate: 3 },
      },
      {
        nodes: [
          {
            id: 'churn_rate',
            metadata: { unit: '%', timeframe: 'monthly' },
          },
        ],
      }
    );

    expect(fromTree[0]).toMatchObject({ unit: '%', timeframe: 'monthly' });

    const inferredAndDefault = deriveKpis(
      {
        outputs: { revenue_delta: 1000, custom_signal: 9 },
      },
      {}
    );

    expect(inferredAndDefault.find((kpi) => kpi.metric === 'revenue_delta')).toMatchObject({
      unit: 'USD',
      timeframe: '12m',
    });
    expect(inferredAndDefault.find((kpi) => kpi.metric === 'custom_signal')).toMatchObject({
      unit: 'units',
      timeframe: '12m',
    });
  });
});
