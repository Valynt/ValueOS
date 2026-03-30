/**
 * ChartBar Component
 * 
 * Individual bar for chart displays with hover effects and animations.
 * Used in revenue trajectory charts and growth visualizations.
 */

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ChartBarProps {
  /** Bar height as percentage (0-100) */
  height: number;
  /** Bar width class */
  width?: string;
  /** Primary color variant */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'muted';
  /** Whether this bar represents the optimized/actual value */
  isOptimized?: boolean;
  /** Optional label below bar */
  label?: string;
  /** Tooltip content on hover */
  tooltip?: string;
  /** Click handler */
  onClick?: () => void;
  /** CSS classes */
  className?: string;
}

const variantColors = {
  primary: {
    base: 'bg-slate-200',
    optimized: 'bg-md-tertiary-container',
    hover: 'hover:bg-slate-300',
  },
  secondary: {
    base: 'bg-slate-200',
    optimized: 'bg-md-secondary-container',
    hover: 'hover:bg-slate-300',
  },
  tertiary: {
    base: 'bg-violet-200',
    optimized: 'bg-md-tertiary-container',
    hover: 'hover:bg-violet-300',
  },
  muted: {
    base: 'bg-slate-100',
    optimized: 'bg-slate-400',
    hover: 'hover:bg-slate-200',
  },
};

export const ChartBar = forwardRef<HTMLDivElement, ChartBarProps>(
  ({ 
    height,
    width = 'w-full',
    variant = 'primary',
    isOptimized = false,
    label,
    tooltip,
    onClick,
    className,
  }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const colors = variantColors[variant];
    
    return (
      <div 
        ref={ref}
        className={cn('flex flex-col items-center gap-2', className)}
      >
        {/* Bar container */}
        <div className="flex-1 w-full flex items-end relative group">
          <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={cn(
              'w-full rounded-t-sm transition-all duration-200',
              isOptimized ? colors.optimized : colors.base,
              !isOptimized && colors.hover,
              'cursor-pointer'
            )}
            style={{ height: `${Math.max(4, height)}%` }}
            aria-label={tooltip || `Value: ${height}%`}
          />
          
          {/* Tooltip */}
          {tooltip && showTooltip && (
            <div className="absolute bottom-full mb-2 px-2 py-1 bg-md-inverse-surface text-md-inverse-on-surface text-xs rounded shadow-lg whitespace-nowrap z-10">
              {tooltip}
            </div>
          )}
        </div>
        
        {/* Label */}
        {label && (
          <span className="text-[10px] font-bold text-md-on-surface-variant uppercase tracking-tighter">
            {label}
          </span>
        )}
      </div>
    );
  }
);

ChartBar.displayName = 'ChartBar';
