import React from 'react';

export interface TrustBadgeTooltipProps {
  confidence: number;
  formula?: string;
  hash?: string;
  sources?: string[];
  reasoning?: string;
  value?: any;
  onClose: () => void;
}

export const TrustBadgeTooltip: React.FC<TrustBadgeTooltipProps> = ({
  confidence,
  formula = 'N/A',
  hash = 'N/A',
  sources = [],
  reasoning = 'Calculated using validated formulas and empirical evidence',
  value,
  onClose
}) => {
  const percentage = Math.round(confidence * 100);
  
  return (
    <div 
      className="trust-badge-tooltip"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '0.5rem',
        zIndex: 1000,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        padding: '1rem',
        width: '320px',
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow */}
      <div 
        style={{
          position: 'absolute',
          top: '-6px',
          right: '10px',
          width: '12px',
          height: '12px',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E5E7EB',
          borderTop: '1px solid #E5E7EB',
          transform: 'rotate(45deg)'
        }}
      />
      
      {/* Header */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid #E5E7EB'
        }}
      >
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <span 
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#111827'
            }}
          >
            Trust Badge
          </span>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            color: '#6B7280',
            padding: '0.25rem',
            lineHeight: 1
          }}
          aria-label="Close tooltip"
        >
          ×
        </button>
      </div>
      
      {/* Content */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        {value !== undefined && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
              VALUE
            </div>
            <div 
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#111827',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {value}
            </div>
          </div>
        )}
        
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
            CONFIDENCE
          </div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div 
              style={{
                flex: 1,
                height: '6px',
                backgroundColor: '#E5E7EB',
                borderRadius: '3px',
                overflow: 'hidden'
              }}
            >
              <div 
                style={{
                  width: `${percentage}%`,
                  height: '100%',
                  backgroundColor: confidence >= 0.9 ? '#10B981' : confidence >= 0.7 ? '#F59E0B' : '#EF4444',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <span 
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#111827',
                minWidth: '3rem',
                textAlign: 'right'
              }}
            >
              {percentage}%
            </span>
          </div>
        </div>
        
        {formula && formula !== 'N/A' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
              FORMULA
            </div>
            <code 
              style={{
                display: 'block',
                padding: '0.5rem',
                backgroundColor: '#F9FAFB',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#374151',
                border: '1px solid #E5E7EB'
              }}
            >
              {formula}
            </code>
          </div>
        )}
        
        {hash && hash !== 'N/A' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
              INTEGRITY HASH
            </div>
            <code 
              style={{
                display: 'block',
                padding: '0.5rem',
                backgroundColor: '#F9FAFB',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#374151',
                border: '1px solid #E5E7EB',
                wordBreak: 'break-all'
              }}
            >
              {hash}
            </code>
          </div>
        )}
        
        {sources && sources.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
              SOURCES
            </div>
            <div 
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.375rem'
              }}
            >
              {sources.map((source, i) => (
                <span 
                  key={i}
                  style={{
                    backgroundColor: '#EEF2FF',
                    color: '#4338CA',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {reasoning && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
              REASONING
            </div>
            <p 
              style={{
                fontSize: '0.8125rem',
                color: '#374151',
                lineHeight: '1.4',
                margin: 0
              }}
            >
              {reasoning}
            </p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div 
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #E5E7EB',
          fontSize: '0.75rem',
          color: '#6B7280',
          textAlign: 'center'
        }}
      >
        Cryptographically verified data
      </div>
    </div>
  );
};