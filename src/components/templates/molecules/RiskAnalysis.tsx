import React from 'react';

export interface RiskScenario {
  npv: number;
  roi: number;
  description: string;
}

export interface RiskAnalysisProps {
  downside: RiskScenario;
  baseCase: RiskScenario;
  upside: RiskScenario;
  confidence?: number;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ 
  downside,
  baseCase,
  upside,
  confidence = 0.95
}) => {
  const scenarios = [
    { name: 'Downside', data: downside, color: '#EF4444', icon: '📉' },
    { name: 'Base Case', data: baseCase, color: '#F59E0B', icon: '📊' },
    { name: 'Upside', data: upside, color: '#10B981', icon: '📈' }
  ];

  // Find best and worst ROI for highlighting
  const bestROI = Math.max(downside.roi, baseCase.roi, upside.roi);
  const worstROI = Math.min(downside.roi, baseCase.roi, upside.roi);

  return (
    <div 
      className="risk-analysis"
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <div 
        className="risk-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: '#111827'
          }}
        >
          Risk Analysis
        </h3>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#6B7280'
          }}
        >
          <span>Confidence:</span>
          <span 
            style={{
              fontWeight: 600,
              color: confidence >= 0.9 ? '#10B981' : confidence >= 0.7 ? '#F59E0B' : '#EF4444'
            }}
          >
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div 
        className="scenarios-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem'
        }}
      >
        {scenarios.map((scenario) => {
          const isBest = scenario.data.roi === bestROI && scenario.data.roi > 0;
          const isWorst = scenario.data.roi === worstROI && scenario.data.roi < 0;
          const isHighlighted = isBest || isWorst;

          return (
            <div 
              key={scenario.name}
              className="scenario-card"
              style={{
                border: `2px solid ${scenario.color}`,
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: isHighlighted ? `${scenario.color}10` : '#FFFFFF',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Badge for best/worst */}
              {(isBest || isWorst) && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '8px',
                    backgroundColor: scenario.color,
                    color: '#FFFFFF',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600
                  }}
                >
                  {isBest ? 'BEST' : 'RISK'}
                </div>
              )}

              {/* Header */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{scenario.icon}</span>
                <span 
                  style={{
                    fontWeight: 600,
                    color: scenario.color,
                    fontSize: '0.875rem'
                  }}
                >
                  {scenario.name}
                </span>
              </div>

              {/* Metrics */}
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>ROI</span>
                  <span 
                    style={{
                      fontWeight: 700,
                      color: scenario.data.roi >= 0 ? '#10B981' : '#EF4444',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    {(scenario.data.roi * 100).toFixed(1)}%
                  </span>
                </div>

                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>NPV</span>
                  <span 
                    style={{
                      fontWeight: 700,
                      color: scenario.data.npv >= 0 ? '#10B981' : '#EF4444',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    ${Math.abs(scenario.data.npv).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div 
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: `1px solid ${scenario.color}30`,
                  fontSize: '0.75rem',
                  color: '#374151',
                  lineHeight: '1.4'
                }}
              >
                {scenario.data.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div 
        style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          backgroundColor: '#F3F4F6',
          borderRadius: '6px',
          fontSize: '0.8125rem',
          color: '#374151',
          lineHeight: '1.4'
        }}
      >
        <strong>Summary:</strong> The analysis shows a{' '}
        <span style={{ color: baseCase.roi > 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
          {(baseCase.roi * 100).toFixed(1)}% ROI
        </span>{' '}
        in the base case, with a range from{' '}
        <span style={{ color: '#EF4444', fontWeight: 600 }}>
          {(downside.roi * 100).toFixed(1)}%
        </span>{' '}
        to{' '}
        <span style={{ color: '#10B981', fontWeight: 600 }}>
          {(upside.roi * 100).toFixed(1)}%
        </span>
        . Risk level is{' '}
        <span style={{ 
          color: Math.abs(baseCase.roi) > 1 ? '#F59E0B' : '#10B981', 
          fontWeight: 600 
        }}>
          {Math.abs(baseCase.roi) > 1 ? 'Medium' : 'Low'}
        </span>
        .
      </div>
    </div>
  );
};