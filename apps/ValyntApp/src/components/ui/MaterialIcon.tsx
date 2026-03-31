/**
 * MaterialIcon Component
 *
 * Wrapper for Material Symbols Outlined icons.
 * Self-hosted font loading with proper fallbacks.
 */

import { forwardRef, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';

export interface MaterialIconProps extends ComponentPropsWithRef<'span'> {
  /** Icon name from Material Symbols */
  icon: string;
  /** Icon size in pixels */
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  /** Font weight (100-700) */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  /** Grade (-50 to 200) */
  grade?: number;
  /** Optical size (20px, 24px, 40px, 48px) */
  opticalSize?: 20 | 24 | 40 | 48;
  /** Whether icon is filled */
  filled?: boolean;
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const MaterialIcon = forwardRef<HTMLSpanElement, MaterialIconProps>(
  ({
    icon,
    size = 'md',
    weight = 400,
    grade = 0,
    opticalSize = 24,
    filled = false,
    className,
    style,
    ...props
  }, ref) => {
    const pixelSize = typeof size === 'number' ? size : sizeMap[size];

    return (
      <span
        ref={ref}
        className={cn(
          'material-symbols-outlined inline-flex items-center justify-center select-none',
          filled && 'material-symbols-filled',
          className
        )}
        style={{
          fontSize: pixelSize,
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      >
        {icon}
      </span>
    );
  }
);

MaterialIcon.displayName = 'MaterialIcon';
