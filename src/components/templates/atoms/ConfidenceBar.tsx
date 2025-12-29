import React from 'react';

export interface ConfidenceBarProps {
  confidence: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ 
  confidence, 
  showLabel = true,
  size = 'medium'
}) => {
  const percentage = Math.round(confidence * 100);
  
  const sizeMap = {
    small: { height: '4px', fontSize: '0.7rem' },
    medium: { height: '6px', fontSize: '0.875rem' },
    large: { height: '8px', fontSize: '1rem' }
  };
  
  const dimensions = sizeMap[size];
  
  // Color based on confidence level
  const getColor = (value: number) => {
    if (value >= 0.9) return '#10B981'; // Green
    if (value >= 0.7) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };
  
  const color = getColor(confidence);
  
  return (
    <div 
      className="confidence-bar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        width: '100%'
      }}
    >
      <div 
        className="confidence-track"
        style={{
          width: '100%',
          height: dimensions.height,
          backgroundColor: '#E5E7EB',
          borderRadius: '9999px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div 
          className="confidence-fill"
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '9999px',
            transition: 'width 0.3s ease, background-color 0.3s ease',
            position: 'relative'
          }}
        >
          {/* Shine effect */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'shine 2s infinite'
            }}
          />
        </div>
      </div>
      
      {showLabel && (
        <div 
          className="confidence-label"
          style={{
            fontSize: dimensions.fontSize,
            color: '#6B7280',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Confidence</span>
          <span 
            style={{ 
              color: color, 
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace'
            }}
          >
            {percentage}%
          </span>
        </div>
      )}
      
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};