import React from 'react';
import { TrustBadge } from './TrustBadge';
import { ConfidenceBar } from './ConfidenceBar';
import { formatNumber } from '../utils/formatters';

export interface KPICardProps {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  confidence: number;
  onTrustClick: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  label, 
  value, 
  unit, 
  trend, 
  confidence, 
  onTrustClick,
  className = ''
}) => {
  const formattedValue = formatNumber(value, unit);
  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#6B7280';
  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';
  
  return (
    <div 
      className={`kpi-card ${className}`} 
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      <div 
        className="kpi-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem'
        }}
      >
        <span 
          className="kpi-label"
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {label}
        </span>
        <TrustBadge confidence={confidence} onClick={onTrustClick} />
      </div>
      
      <div 
        className="kpi-value-wrapper"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}
      >
        <span 
          className="kpi-value"
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: trendColor,
            fontFamily: 'JetBrains Mono, monospace'
          }}
        >
          {formattedValue}
        </span>
        <span 
          className="kpi-trend"
          style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: trendColor
          }}
        >
          {trendSymbol}
        </span>
      </div>
      
      <div className="kpi-confidence">
        <ConfidenceBar confidence={confidence} />
      </div>
      
      {/* Hover overlay for better UX */}
      <div 
        className="hover-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(59, 130, 246, 0.05)',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          borderRadius: '12px',
          pointerEvents: 'none'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
      />
    </div>
  );
};