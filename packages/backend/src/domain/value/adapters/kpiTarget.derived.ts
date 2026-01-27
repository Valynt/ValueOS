import { KpiTarget } from '../dto';
import { KpiTargetSchema } from '../schemas/kpiTarget.schema';

// Derive KPIs from RoiModel and ValueTree (no persistence)
export function deriveKpis(model: any, tree: any): KpiTarget[] {
  // Example: derive from model.outputs
  const kpis: KpiTarget[] = Object.entries(model.outputs ?? {}).map(([metric, value]) => {
    const kpi: KpiTarget = {
      metric,
      targetValue: value,
      unit: 'USD', // TODO: derive real unit
      timeframe: 'FY2026', // TODO: derive real timeframe
      basis: `from financial_models.outputs[metric=${metric}]`,
    };
    KpiTargetSchema.parse(kpi);
    return kpi;
  });
  return kpis;
}
