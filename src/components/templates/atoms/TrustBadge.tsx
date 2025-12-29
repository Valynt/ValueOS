import React, { useState } from 'react';
import { TrustBadgeTooltip } from './TrustBadgeTooltip';

export interface TrustBadgeProps {
  confidence: number;
  onClick: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ 
  confidence, 
  onClick,
  size = 'medium'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const color = confidence >= 0.9 ? '#10B981' : confidence >= 0.7 ? '#F59E0B' : '#EF4444';
  const icon = confidence >= 0.9 ? '🛡️' : confidence >= 0.7 ? '⚠️' : '❌';
  
  const sizeMap = {
    small: { width: '20px', height: '20px', fontSize: '0.75rem' },
    medium: { width: '28px', height: '28px', fontSize: '1rem' },
    large: { width: '36px', height: '36px', fontSize: '1.25rem' }
  };
  
  const dimensions = sizeMap[size];
  
  return (
    <div 
      className="trust-badge-wrapper"
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className="trust-badge"
        onClick={onClick}
        role="button"
        aria-label={`Trust badge: ${(confidence * 100).toFixed(0)}% confidence`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          fontSize: dimensions.fontSize,
          fontWeight: 'bold',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        }}
      >
        {icon}
      </div>
      
      {showTooltip && (
        <TrustBadgeTooltip 
          confidence={confidence}
          onClose={() => setShowTooltip(false)}
        />
      )}
    </div>
  );
};