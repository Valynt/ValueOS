/**
 * ProgressRing Component
 *
 * Circular progress indicator with animated value display.
 * Used for engagement scores and KPI progress tracking.
 */

import React, { forwardRef, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Ring size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Color variant */
  variant?: 'default' | 'success' | 'tertiary' | 'muted';
  /** Show value in center */
  showValue?: boolean;
  /** Optional label below value */
  label?: string;
}

const variantColors = {
  default: 'stroke-md-secondary',
  success: 'stroke-emerald-500',
  tertiary: 'stroke-md-tertiary-container',
  muted: 'stroke-slate-400',
};

const bgColors = {
  default: 'text-md-surface-container-high',
  success: 'text-emerald-100',
  tertiary: 'text-violet-100',
  muted: 'text-slate-200',
};

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(
  ({
    value,
    max = 100,
    size = 96,
    strokeWidth = 8,
    variant = 'default',
    showValue = true,
    label,
    className,
    ...rest
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const textSize = useMemo(() => {
      if (size < 64) return 'text-sm';
      if (size < 96) return 'text-lg';
      if (size < 128) return 'text-2xl';
      return 'text-3xl';
    }, [size]);

    return (
      <div ref={ref} className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} {...rest}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={bgColors[variant]}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-all duration-500 ease-out', variantColors[variant])}
          />
        </svg>

        {/* Center content */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-black', textSize)}>
              {Math.round(percentage)}
            </span>
            {label && (
              <span className="text-[10px] font-medium text-md-on-surface-variant mt-0.5">
                {label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

ProgressRing.displayName = 'ProgressRing';
