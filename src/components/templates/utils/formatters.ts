/**
 * Formatters for template components
 */

export const formatNumber = (value: number, unit: string): string => {
  if (unit === '$') {
    // Format currency
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  }
  
  if (unit === '%') {
    return `${(value * 100).toFixed(1)}%`;
  }
  
  if (unit === 'days') {
    return `${value.toFixed(0)} days`;
  }
  
  return value.toLocaleString();
};

export const formatActionName = (action: string): string => {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Pct', '%');
};

export const formatKPIName = (kpi: string): string => {
  const nameMap: Record<string, string> = {
    'saas_arr': 'ARR',
    'saas_mrr': 'MRR',
    'saas_nrr': 'NRR',
    'saas_logo_churn': 'Logo Churn',
    'saas_cac': 'CAC',
    'saas_ltv': 'LTV',
    'saas_arpu': 'ARPU',
    'fin_ccc': 'Cash Conversion Cycle',
    'mfg_oee': 'OEE'
  };
  
  return nameMap[kpi] || kpi.replace(/_/g, ' ').toUpperCase();
};

export const formatPersonaName = (persona: string): string => {
  const personaMap: Record<string, string> = {
    'cfo': 'Chief Financial Officer',
    'cio': 'Chief Information Officer',
    'cto': 'Chief Technology Officer',
    'coo': 'Chief Operating Officer',
    'vp_sales': 'VP Sales',
    'vp_ops': 'VP Operations',
    'vp_engineering': 'VP Engineering',
    'director_finance': 'Director of Finance',
    'data_analyst': 'Data Analyst'
  };
  
  return personaMap[persona] || persona.replace(/_/g, ' ').toUpperCase();
};

export const formatMetric = (metric: { value: number; unit?: string; trend?: string }): string => {
  const unit = metric.unit || '';
  const value = formatNumber(metric.value, unit);
  
  if (metric.trend) {
    const symbol = metric.trend === 'up' ? '▲' : metric.trend === 'down' ? '▼' : '─';
    return `${value} ${symbol}`;
  }
  
  return value;
};

export const calculateOverallConfidence = (children: React.ReactNode): number => {
  // This would typically be calculated from the data
  // For now, return a default high confidence
  return 0.95;
};