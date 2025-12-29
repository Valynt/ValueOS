import React from 'react';

export interface CashFlowData {
  year: number;
  cashFlow: number;
  cumulative?: number;
}

export interface CashFlowProjection {
  downside: CashFlowData[];
  baseCase: CashFlowData[];
  upside: CashFlowData[];
}

export interface CashFlowChartProps {
  data: number[]; // Yearly cash flow projections
  projection?: CashFlowProjection;
  height?: number;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ 
  data,
  projection,
  height = 250
}) => {
  // Transform data for chart
  const chartData = data.map((value, index) => ({
    year: index + 1,
    value
  }));

  const maxValue = Math.max(...data, 0);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  return (
    <div 
      className="cash-flow-chart"
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div 
        className="chart-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
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
          Cash Flow Projection
        </h3>
        <span 
          style={{
            fontSize: '0.75rem',
            color: '#6B7280'
          }}
        >
          3-Year Outlook
        </span>
      </div>

      <div 
        className="chart-area"
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1rem',
          padding: '0.5rem 0'
        }}
      >
        {chartData.map((item, index) => {
          const barHeight = ((item.value - minValue) / range) * 100;
          const isPositive = item.value >= 0;
          
          return (
            <div 
              key={index}
              className="bar-container"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                position: 'relative'
              }}
            >
              {/* Bar */}
              <div 
                className="bar"
                style={{
                  width: '60%',
                  height: `${barHeight}%`,
                  backgroundColor: isPositive ? '#10B981' : '#EF4444',
                  borderRadius: '4px 4px 0 0',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  minHeight: '4px'
                }}
                title={`Year ${item.year}: $${item.value.toLocaleString()}`}
              >
                {/* Value label on hover */}
                <div 
                  className="bar-label"
                  style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#111827',
                    color: '#FFFFFF',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    whiteSpace: 'nowrap',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none'
                  }}
                >
                  ${Math.abs(item.value).toLocaleString()}
                </div>
              </div>

              {/* Year label */}
              <div 
                className="year-label"
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#6B7280'
                }}
              >
                Y{item.year}
              </div>

              {/* Zero line indicator */}
              {index === 0 && (
                <div 
                  style={{
                    position: 'absolute',
                    bottom: `${((0 - minValue) / range) * 100}%`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#9CA3AF',
                    opacity: 0.5
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {projection && (
        <div 
          className="chart-legend"
          style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '0.75rem',
            justifyContent: 'center',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#10B981', borderRadius: '2px' }} />
            <span>Actual</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#F59E0B', borderRadius: '2px', opacity: 0.3 }} />
            <span>Projection</span>
          </div>
        </div>
      )}

      {/* Hover effects */}
      <style jsx>{`
        .bar:hover {
          transform: scaleY(1.05);
          filter: brightness(1.1);
        }
        .bar:hover + .bar-label {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};