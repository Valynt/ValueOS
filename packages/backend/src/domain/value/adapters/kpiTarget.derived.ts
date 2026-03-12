import { KpiTarget } from '../dto';
import { KpiTargetSchema } from '../schemas/kpiTarget.schema';

interface KPIHints {
  unit?: string;
  timeframe?: string;
}

interface ModelInput {
  outputs?: Record<string, number>;
  unit?: string;
  timeframe?: string;
  assumptions?: Record<string, unknown>;
  kpiHints?: Record<string, KPIHints>;
  metadata?: {
    defaultUnit?: string;
    defaultTimeframe?: string;
    units?: Record<string, string>;
    timeframes?: Record<string, string>;
  };
}

interface TreeInput {
  nodes?: Array<{
    id?: string;
    label?: string;
    metadata?: {
      unit?: string;
      timeframe?: string;
    };
  }>;
}

const inferUnitFromMetric = (metric: string): string | undefined => {
  const normalized = metric.toLowerCase();
  if (/(percentage|percent|rate|margin)/.test(normalized)) return '%';
  if (/(day|days)/.test(normalized)) return 'days';
  if (/(hour|hours)/.test(normalized)) return 'hours';
  if (/(count|volume|users|units|tickets)/.test(normalized)) return 'count';
  if (/(revenue|cost|profit|roi|arr|mrr)/.test(normalized)) return 'USD';
  return undefined;
};

const findNodeHint = (tree: TreeInput, metric: string): KPIHints => {
  const metricKey = metric.toLowerCase();
  const node = tree.nodes?.find((n) => {
    const id = n.id?.toLowerCase();
    const label = n.label?.toLowerCase();
    return id === metricKey || label === metricKey;
  });
  return {
    unit: node?.metadata?.unit,
    timeframe: node?.metadata?.timeframe,
  };
};

// Derive KPIs from RoiModel and ValueTree (no persistence)
export function deriveKpis(model: ModelInput, tree: TreeInput): KpiTarget[] {
  const kpis: KpiTarget[] = Object.entries(model.outputs ?? {}).map(([metric, value]) => {
    const treeHint = findNodeHint(tree, metric);
    const unit =
      model.kpiHints?.[metric]?.unit ??
      model.metadata?.units?.[metric] ??
      treeHint.unit ??
      inferUnitFromMetric(metric) ??
      model.unit ??
      model.metadata?.defaultUnit ??
      'units';

    const timeframe =
      model.kpiHints?.[metric]?.timeframe ??
      model.metadata?.timeframes?.[metric] ??
      treeHint.timeframe ??
      model.timeframe ??
      (typeof model.assumptions?.timeframe === 'string' ? model.assumptions.timeframe : undefined) ??
      model.metadata?.defaultTimeframe ??
      '12m';

    const kpi: KpiTarget = {
      metric,
      targetValue: value,
      unit,
      timeframe,
      basis: `from financial_models.outputs[metric=${metric}]`,
    };
    KpiTargetSchema.parse(kpi);
    return kpi;
  });
  return kpis;
}
