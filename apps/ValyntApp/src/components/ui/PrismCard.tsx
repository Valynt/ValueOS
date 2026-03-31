/**
 * PrismCard Component
 *
 * Clean card with subtle border and hover effect.
 * Used for value pyramid, settings, and structured layouts.
 */

import { motion } from 'framer-motion';
import { forwardRef, type ReactNode, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export interface PrismCardProps extends ComponentPropsWithoutRef<'div'> {
  /** Whether card is in an active/selected state */
  active?: boolean;
  /** Hover effect intensity */
  hover?: 'none' | 'subtle' | 'lift';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether to animate on mount */
  animate?: boolean;
  /** Animation delay index for staggered reveals */
  index?: number;
}

const hoverClasses = {
  none: '',
  subtle: 'hover:border-md-outline-variant transition-colors duration-200',
  lift: 'hover:border-md-outline-variant hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const PrismCard = forwardRef<HTMLDivElement, PrismCardProps>(
  ({
    children,
    className,
    active = false,
    hover = 'subtle',
    padding = 'md',
    animate = true,
    index = 0,
    ...props
  }, ref) => {
    const combinedClassName = cn(
      'bg-md-surface-container-lowest rounded-xl border border-md-outline',
      active && 'border-md-tertiary-container ring-1 ring-md-tertiary-container/20',
      hoverClasses[hover],
      paddingClasses[padding],
      className
    );

    if (animate) {
      return (
        <motion.div
          ref={ref}
          className={combinedClassName}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: index * 0.1,
            ease: [0.4, 0, 0.2, 1]
          }}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {children}
      </div>
    );
  }
);

PrismCard.displayName = 'PrismCard';
