/**
 * MetricCard Component
 * 
 * Displays key metrics with optional trend indicator and animation.
 * Used in executive summary for revenue, conversion, and KPI displays.
 */

import { forwardRef, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';

export interface MetricCardProps extends ComponentPropsWithRef<'div'> {
  /** Metric label/title */
  label: string;
  /** Metric value (can include prefix like $) */
  value: string | number;
  /** Optional trend indicator (+/- percentage) */
  trend?: {
    value: number;
    label?: string;
  };
  /** Visual variant */
  variant?: 'default' | 'highlight' | 'compact';
  /** Optional secondary text */
  description?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses = {
  default: 'bg-md-surface-container-lowest border-md-outline',
  highlight: 'bg-md-primary-container text-md-on-primary-container border-transparent',
  compact: 'bg-transparent border-transparent',
};

const sizeClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const valueSizeClasses = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-5xl',
};

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ 
    label,
    value,
    trend,
    variant = 'default',
    description,
    size = 'md',
    className,
    ...props 
  }, ref) => {
    const isPositive = trend && trend.value >= 0;
    
    return (
      <div 
        ref={ref}
        className={cn(
          'rounded-xl border relative overflow-hidden',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Label */}
        <span className={cn(
          'text-xs font-semibold uppercase tracking-widest block mb-2',
          variant === 'highlight' ? 'opacity-60' : 'text-md-on-surface-variant'
        )}>
          {label}
        </span>
        
        {/* Value and trend row */}
        <div className="flex items-baseline gap-3">
          <span className={cn(
            'font-bold tracking-tight leading-none',
            valueSizeClasses[size],
            variant === 'highlight' ? 'text-white' : 'text-md-primary'
          )}>
            {value}
          </span>
          
          {trend && (
            <span className={cn(
              'text-sm font-medium',
              isPositive ? 'text-emerald-500' : 'text-red-500'
            )}>
              {isPositive ? '+' : ''}{trend.value}%
              {trend.label && (
                <span className="ml-1 opacity-70">{trend.label}</span>
              )}
            </span>
          )}
        </div>
        
        {/* Description */}
        {description && (
          <p className={cn(
            'mt-4 text-sm leading-relaxed',
            variant === 'highlight' ? 'opacity-70' : 'text-md-on-surface-variant'
          )}>
            {description}
          </p>
        )}
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';
