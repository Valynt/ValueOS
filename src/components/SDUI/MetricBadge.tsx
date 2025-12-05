import React from 'react';

/**
 * Tone variants for MetricBadge
 */
export type MetricBadgeTone = 'success' | 'warning' | 'error' | 'info';

/**
 * Props for MetricBadge component
 */
export interface MetricBadgeProps {
  /**
   * Label for the metric
   */
  label: string;

  /**
   * Value to display (number or string)
   */
  value: number | string;

  /**
   * Visual tone/color scheme
   * @default 'info'
   */
  tone?: MetricBadgeTone;

  /**
   * Optional unit to display after value (e.g., '%', 'hrs', 'USD')
   */
  unit?: string;

  /**
   * Size variant
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Optional icon to display before label
   */
  icon?: React.ReactNode;

  /**
   * Optional click handler
   */
  onClick?: () => void;
}

/**
 * MetricBadge - Displays a KPI label with a numeric or percentage value
 *
 * Used throughout the VOS lifecycle to show key metrics, KPIs, and values
 * in a consistent, visually appealing format.
 *
 * @example
 * ```tsx
 * <MetricBadge
 *   label="Conversion Rate"
 *   value={23.5}
 *   unit="%"
 *   tone="success"
 * />
 * ```
 */
export const MetricBadge: React.FC<MetricBadgeProps> = ({
  label,
  value,
  tone = 'info',
  unit,
  size = 'medium',
  icon,
  onClick,
}) => {
  // Tone-based styling
  const toneClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  // Size-based styling
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };

  // Format value
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${toneClasses[tone]}
        ${sizeClasses[size]}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      data-testid="metric-badge"
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="font-semibold">{label}:</span>
      <span className="font-bold">
        {formattedValue}
        {unit && <span className="ml-0.5">{unit}</span>}
      </span>
    </span>
  );
};

/**
 * MetricBadgeGroup - Container for multiple metric badges
 */
export interface MetricBadgeGroupProps {
  /**
   * Array of metric badge props
   */
  metrics: Omit<MetricBadgeProps, 'size'>[];

  /**
   * Layout direction
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical';

  /**
   * Size for all badges in group
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Optional title for the group
   */
  title?: string;
}

export const MetricBadgeGroup: React.FC<MetricBadgeGroupProps> = ({
  metrics,
  direction = 'horizontal',
  size = 'medium',
  title,
}) => {
  const containerClasses =
    direction === 'horizontal' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2';

  return (
    <div className="space-y-2" data-testid="metric-badge-group">
      {title && <h4 className="text-sm font-semibold text-gray-700">{title}</h4>}
      <div className={containerClasses}>
        {metrics.map((metric, index) => (
          <MetricBadge key={`${metric.label}-${index}`} {...metric} size={size} />
        ))}
      </div>
    </div>
  );
};
