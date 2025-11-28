/**
 * ConfidenceIndicator Component
 * 
 * Visual confidence meter for AI outputs (0-100%).
 * Color-coded with animation and tooltip explanation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

export interface ConfidenceIndicatorProps {
  /**
   * Confidence value (0-100)
   */
  value: number;

  /**
   * Label for the indicator
   */
  label?: string;

  /**
   * Explanation text shown in tooltip
   */
  explanation?: string;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Display variant
   */
  variant?: 'bar' | 'circle' | 'badge';

  /**
   * Show percentage text
   */
  showPercentage?: boolean;

  /**
   * Show confidence level label (Low/Medium/High)
   */
  showLevel?: boolean;

  /**
   * Animate on value change
   */
  animated?: boolean;

  /**
   * Custom color thresholds
   */
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };

  /**
   * Custom colors
   */
  colors?: {
    low: string;
    medium: string;
    high: string;
  };

  className?: string;
}

const DEFAULT_THRESHOLDS = {
  low: 33,
  medium: 66,
  high: 100,
};

const DEFAULT_COLORS = {
  low: '#FF3B30',
  medium: '#FFB800',
  high: '#39FF14',
};

/**
 * Get confidence level based on value
 */
function getConfidenceLevel(value: number, thresholds = DEFAULT_THRESHOLDS): 'low' | 'medium' | 'high' {
  if (value < thresholds.low) return 'low';
  if (value < thresholds.medium) return 'medium';
  return 'high';
}

/**
 * Get color based on confidence level
 */
function getColor(level: 'low' | 'medium' | 'high', colors = DEFAULT_COLORS): string {
  return colors[level];
}

/**
 * ConfidenceIndicator Component
 */
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  value: initialValue,
  label,
  explanation,
  size = 'md',
  variant = 'bar',
  showPercentage = true,
  showLevel = false,
  animated = true,
  thresholds = DEFAULT_THRESHOLDS,
  colors = DEFAULT_COLORS,
  className = '',
}) => {
  const [value, setValue] = useState(animated ? 0 : initialValue);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, initialValue));

  // Animate value change
  useEffect(() => {
    if (!animated) {
      setValue(clampedValue);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const stepValue = (clampedValue - value) / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setValue(clampedValue);
        clearInterval(interval);
      } else {
        setValue((prev) => prev + stepValue);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [clampedValue, animated]);

  const level = getConfidenceLevel(value, thresholds);
  const color = getColor(level, colors);

  const sizeClasses = {
    sm: 'sdui-confidence-sm',
    md: 'sdui-confidence-md',
    lg: 'sdui-confidence-lg',
  };

  const levelLabels = {
    low: 'Low Confidence',
    medium: 'Medium Confidence',
    high: 'High Confidence',
  };

  return (
    <div className={`sdui-confidence-indicator ${sizeClasses[size]} ${className}`}>
      {label && <div className="sdui-confidence-label">{label}</div>}

      <div className="sdui-confidence-content">
        {variant === 'bar' && (
          <div className="sdui-confidence-bar-container">
            <div className="sdui-confidence-bar-track">
              <div
                className="sdui-confidence-bar-fill"
                style={{
                  width: `${value}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            </div>
            {showPercentage && (
              <div className="sdui-confidence-percentage" style={{ color }}>
                {Math.round(value)}%
              </div>
            )}
          </div>
        )}

        {variant === 'circle' && (
          <div className="sdui-confidence-circle-container">
            <svg className="sdui-confidence-circle" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#333333"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - value / 100)}`}
                transform="rotate(-90 50 50)"
                style={{
                  filter: `drop-shadow(0 0 4px ${color})`,
                  transition: animated ? 'stroke-dashoffset 1s ease-out' : 'none',
                }}
              />
            </svg>
            {showPercentage && (
              <div className="sdui-confidence-circle-text" style={{ color }}>
                {Math.round(value)}%
              </div>
            )}
          </div>
        )}

        {variant === 'badge' && (
          <div
            className="sdui-confidence-badge"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              borderColor: color,
            }}
          >
            {showPercentage && <span className="sdui-confidence-badge-value">{Math.round(value)}%</span>}
            {showLevel && <span className="sdui-confidence-badge-level">{levelLabels[level]}</span>}
          </div>
        )}

        {explanation && (
          <div className="sdui-confidence-info">
            <button
              className="sdui-confidence-info-btn"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label="Show explanation"
            >
              <Info size={16} />
            </button>
            {showTooltip && (
              <div ref={tooltipRef} className="sdui-confidence-tooltip">
                {explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {showLevel && variant !== 'badge' && (
        <div className="sdui-confidence-level" style={{ color }}>
          {levelLabels[level]}
        </div>
      )}

      <style jsx>{`
        .sdui-confidence-indicator {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sdui-confidence-label {
          color: #B3B3B3;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sdui-confidence-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Bar variant */
        .sdui-confidence-bar-container {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .sdui-confidence-bar-track {
          flex: 1;
          height: 8px;
          background-color: #333333;
          border-radius: 4px;
          overflow: hidden;
        }

        .sdui-confidence-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 1s ease-out, background-color 300ms;
        }

        .sdui-confidence-percentage {
          font-size: 14px;
          font-weight: 600;
          min-width: 45px;
          text-align: right;
        }

        /* Circle variant */
        .sdui-confidence-circle-container {
          position: relative;
          width: 80px;
          height: 80px;
        }

        .sdui-confidence-circle {
          width: 100%;
          height: 100%;
        }

        .sdui-confidence-circle-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 18px;
          font-weight: 700;
        }

        /* Badge variant */
        .sdui-confidence-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1px solid;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
        }

        .sdui-confidence-badge-value {
          font-weight: 700;
        }

        .sdui-confidence-badge-level {
          font-weight: 500;
        }

        /* Info tooltip */
        .sdui-confidence-info {
          position: relative;
        }

        .sdui-confidence-info-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: transparent;
          border: none;
          border-radius: 50%;
          color: #B3B3B3;
          cursor: pointer;
          transition: all 150ms;
        }

        .sdui-confidence-info-btn:hover {
          background-color: #333333;
          color: #39FF14;
        }

        .sdui-confidence-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          max-width: 300px;
          padding: 12px;
          background-color: #333333;
          border: 1px solid #444444;
          border-radius: 8px;
          color: #FFFFFF;
          font-size: 12px;
          line-height: 1.5;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }

        .sdui-confidence-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          right: 8px;
          border: 6px solid transparent;
          border-top-color: #333333;
        }

        .sdui-confidence-level {
          font-size: 12px;
          font-weight: 600;
        }

        /* Sizes */
        .sdui-confidence-sm .sdui-confidence-bar-track {
          height: 6px;
        }

        .sdui-confidence-sm .sdui-confidence-percentage {
          font-size: 12px;
        }

        .sdui-confidence-sm .sdui-confidence-circle-container {
          width: 60px;
          height: 60px;
        }

        .sdui-confidence-sm .sdui-confidence-circle-text {
          font-size: 14px;
        }

        .sdui-confidence-md .sdui-confidence-bar-track {
          height: 8px;
        }

        .sdui-confidence-md .sdui-confidence-percentage {
          font-size: 14px;
        }

        .sdui-confidence-md .sdui-confidence-circle-container {
          width: 80px;
          height: 80px;
        }

        .sdui-confidence-md .sdui-confidence-circle-text {
          font-size: 18px;
        }

        .sdui-confidence-lg .sdui-confidence-bar-track {
          height: 12px;
        }

        .sdui-confidence-lg .sdui-confidence-percentage {
          font-size: 16px;
        }

        .sdui-confidence-lg .sdui-confidence-circle-container {
          width: 100px;
          height: 100px;
        }

        .sdui-confidence-lg .sdui-confidence-circle-text {
          font-size: 22px;
        }
      `}</style>
    </div>
  );
};

export default ConfidenceIndicator;
