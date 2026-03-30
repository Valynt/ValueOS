/**
 * ValuePyramid Component
 * 
 * Hierarchical value visualization showing opportunity → target → realization → expansion.
 * Used in value case workspace for lifecycle stage visualization.
 */

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { PrismCard } from './PrismCard';
import { MaterialIcon } from './MaterialIcon';

export interface PyramidLevel {
  /** Level ID */
  id: string;
  /** Level title */
  title: string;
  /** Level description */
  description?: string;
  /** Current value/state */
  value?: string;
  /** Completion percentage (0-100) */
  completion: number;
  /** Icon name from Material Symbols */
  icon?: string;
  /** Whether level is active/selected */
  active?: boolean;
  /** Whether level is expanded */
  expanded?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface ValuePyramidProps {
  /** Pyramid levels from bottom to top */
  levels: PyramidLevel[];
  /** Whether to show connector lines */
  showConnectors?: boolean;
  /** Whether levels are clickable */
  interactive?: boolean;
  /** CSS classes */
  className?: string;
}

export const ValuePyramid = forwardRef<HTMLDivElement, ValuePyramidProps>(
  ({ 
    levels,
    showConnectors = true,
    interactive = true,
    className,
  }, ref) => {
    const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
    
    // Reverse levels for pyramid display (bottom to top)
    const displayLevels = [...levels].reverse();
    
    return (
      <div ref={ref} className={cn('flex flex-col items-center gap-2', className)}>
        {displayLevels.map((level, index) => {
          const isExpanded = expandedLevel === level.id;
          const widthClass = index === 0 
            ? 'w-full' 
            : index === 1 
              ? 'w-[85%]' 
              : index === 2 
                ? 'w-[70%]' 
                : 'w-[55%]';
          
          return (
            <div 
              key={level.id} 
              className={cn(
                'relative',
                widthClass,
                index < displayLevels.length - 1 && showConnectors && 'pb-4'
              )}
            >
              {/* Connector line to next level */}
              {index < displayLevels.length - 1 && showConnectors && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-px h-4 bg-md-outline-variant" />
              )}
              
              <PrismCard
                active={level.active}
                hover={interactive ? 'lift' : 'none'}
                padding="sm"
                onClick={() => {
                  if (interactive) {
                    level.onClick?.();
                    setExpandedLevel(isExpanded ? null : level.id);
                  }
                }}
                className={cn(
                  'relative',
                  interactive && 'cursor-pointer'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  {level.icon && (
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      level.active 
                        ? 'bg-md-tertiary-container text-white' 
                        : 'bg-md-surface-container-high text-md-on-surface-variant'
                    )}>
                      <MaterialIcon icon={level.icon} size="md" filled={level.active} />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={cn(
                        'font-semibold text-sm truncate',
                        level.active ? 'text-md-on-surface' : 'text-md-on-surface-variant'
                      )}>
                        {level.title}
                      </h4>
                      
                      {level.value && (
                        <span className="text-xs font-medium text-md-tertiary-container ml-2 flex-shrink-0">
                          {level.value}
                        </span>
                      )}
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mt-2 h-1 bg-md-surface-container-high rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          level.active ? 'bg-md-tertiary-container' : 'bg-md-outline'
                        )}
                        style={{ width: `${level.completion}%` }}
                      />
                    </div>
                    
                    {/* Expanded description */}
                    {(level.expanded || isExpanded) && level.description && (
                      <p className="mt-2 text-xs text-md-on-surface-variant leading-relaxed">
                        {level.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Completion indicator */}
                  <div className="flex-shrink-0 text-xs font-medium text-md-on-surface-variant">
                    {level.completion}%
                  </div>
                </div>
              </PrismCard>
            </div>
          );
        })}
      </div>
    );
  }
);

ValuePyramid.displayName = 'ValuePyramid';
