/**
 * Progress Bar Component
 * Shows deterministic or indeterminate progress for long operations
 */

import React from 'react';

interface ProgressBarProps {
  progress?: number; // 0-100, undefined for indeterminate
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const variantColors = {
  primary: 'bg-indigo-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  size = 'md',
  variant = 'primary',
  showPercentage = false,
  className = '',
}) => {
  const isIndeterminate = progress === undefined;
  const clampedProgress = progress !== undefined ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2 text-sm">
          {label && <span className="text-gray-700">{label}</span>}
          {showPercentage && progress !== undefined && (
            <span className="text-gray-500 font-medium">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      
      <div 
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={!isIndeterminate ? clampedProgress : undefined}
        aria-label={label || 'Progress'}
        aria-busy={isIndeterminate || clampedProgress < 100}
      >
        <div
          className={`h-full ${variantColors[variant]} transition-all duration-300 ease-out ${
            isIndeterminate ? 'animate-indeterminate-progress' : ''
          }`}
          style={{
            width: isIndeterminate ? '40%' : `${clampedProgress}%`,
          }}
        />
      </div>
    </div>
  );
};

/**
 * Multi-step Progress Indicator
 * Shows progress through a series of steps
 */
interface Step {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface StepProgressProps {
  steps: Step[];
  className?: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({ steps, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`} role="progressbar" aria-label="Step progress">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        const statusConfig = {
          pending: {
            icon: <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />,
            lineColor: 'bg-gray-300',
            textColor: 'text-gray-500',
          },
          active: {
            icon: (
              <div className="w-6 h-6 rounded-full border-2 border-indigo-600 bg-white relative">
                <div className="absolute inset-1 rounded-full bg-indigo-600 animate-pulse" />
              </div>
            ),
            lineColor: 'bg-gray-300',
            textColor: 'text-indigo-600 font-medium',
          },
          complete: {
            icon: (
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ),
            lineColor: 'bg-green-600',
            textColor: 'text-gray-700',
          },
          error: {
            icon: (
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ),
            lineColor: 'bg-red-600',
            textColor: 'text-red-600',
          },
        };

        const config = statusConfig[step.status];

        return (
          <div key={index} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {config.icon}
              {!isLast && (
                <div className={`w-0.5 h-8 mt-2 ${config.lineColor} transition-colors`} />
              )}
            </div>
            <div className="flex-1 pt-0.5">
              <p className={`text-sm ${config.textColor} transition-colors`}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Add CSS for indeterminate animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes indeterminate-progress {
      0% {
        transform: translateX(-100%);
      }
      50% {
        transform: translateX(0%);
      }
      100% {
        transform: translateX(100%);
      }
    }
    .animate-indeterminate-progress {
      animation: indeterminate-progress 1.5s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}
