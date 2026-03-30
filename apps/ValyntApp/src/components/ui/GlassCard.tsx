/**
 * GlassCard Component
 *
 * Glassmorphism card with backdrop blur effect.
 * Used for floating badges, overlays, and elevated surfaces.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Blur intensity in pixels */
  blur?: number;
  /** Background opacity (0-1) */
  opacity?: number;
  /** Border color opacity */
  borderOpacity?: number;
  /** Shadow elevation level */
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Whether to animate on mount */
  animated?: boolean;
}

const elevationClasses = {
  0: '',
  1: 'shadow-sm',
  2: 'shadow-md',
  3: 'shadow-lg',
  4: 'shadow-xl',
  5: 'shadow-2xl',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({
    children,
    className,
    blur = 12,
    opacity = 0.6,
    borderOpacity = 0.1,
    elevation = 2,
    animate = true,
    style,
    ...props
  }, ref) => {
    const baseStyles = {
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`,
      backgroundColor: `rgba(255, 255, 255, ${opacity})`,
      border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
    };

    const combinedClassName = cn(
      'rounded-xl',
      elevationClasses[elevation],
      className
    );

    if (animated) {
      return (
        <motion.div
          ref={ref}
          className={combinedClassName}
          style={{ ...baseStyles, ...style }}
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{
            opacity: 1,
            backdropFilter: `blur(${blur}px)`,
          }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={combinedClassName}
        style={{ ...baseStyles, ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
