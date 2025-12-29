import React from 'react';
import { KPICard } from '../atoms/KPICard';
import { formatNumber } from '../utils/formatters';

export interface FinancialMetrics {
  roi: number;
  npv: number;
  paybackPeriod: number;
  roiConfidence?: number;
  npvConfidence?: number;
  paybackConfidence?: number;
}

export interface FinancialSummaryProps {
  financials: FinancialMetrics;
  onTrustClick: (metric: string) => void;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({ 
  financials,
  onTrustClick
}) => {
  const { roi, npv, paybackPeriod, roiConfidence = 0.95, npvConfidence = 0.95, paybackConfidence = 0.95 } = financials;
  
  // Calculate trends based on values
  const roiTrend = roi > 0 ? 'up' : 'down';
  const npvTrend = npv > 0 ? 'up' : 'down';
  const paybackTrend = 'flat'; // Payback is typically neutral
  
  return (
    <div 
      className="financial-summary"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        width: '100%'
      }}
    >
      <KPICard
        label="ROI"
        value={roi * 100}
        unit="%"
        trend={roiTrend}
        confidence={roiConfidence}
        onTrustClick={() => onTrustClick('roi')}
      />
      
      <KPICard
        label="NPV"
        value={npv}
        unit="$"
        trend={npvTrend}
        confidence={npvConfidence}
        onTrustClick={() => onTrustClick('npv')}
      />
      
      <KPICard
        label="Payback"
        value={paybackPeriod}
        unit="days"
        trend={paybackTrend}
        confidence={paybackConfidence}
        onTrustClick={() => onTrustClick('payback')}
      />
    </div>
  );
};