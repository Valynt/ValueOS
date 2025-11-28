/**
 * SDUI Dark Theme System
 * 
 * Based on Sales AI Enterprise MCP Platform UI Style Guide:
 * - Dark background (#121212)
 * - Neon green accents (#39FF14)
 * - Inter font family
 * - 8px spacing system
 */

/**
 * Color palette
 */
export const SDUIColors = {
  // Primary colors
  dark: '#121212',
  neon: '#39FF14',
  neonDark: '#0A3A0A',
  
  // Surface colors
  card: '#333333',
  cardHover: '#3A3A3A',
  border: '#444444',
  borderHover: '#555555',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary: '#808080',
  textInverse: '#121212',
  
  // Status colors
  success: '#39FF14',
  warning: '#FFB800',
  error: '#FF3B30',
  info: '#0A84FF',
  
  // Semantic colors
  background: '#121212',
  backgroundElevated: '#1A1A1A',
  surface: '#333333',
  surfaceHover: '#3A3A3A',
  
  // Overlay colors
  overlay: 'rgba(18, 18, 18, 0.8)',
  overlayLight: 'rgba(18, 18, 18, 0.6)',
} as const;

/**
 * Typography system (Inter font family)
 */
export const SDUITypography = {
  fontFamily: {
    base: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

/**
 * Spacing system (8px base unit)
 */
export const SDUISpacing = {
  xs: '8px',
  sm: '16px',
  md: '24px',
  lg: '32px',
  xl: '48px',
  '2xl': '64px',
  '3xl': '96px',
  '4xl': '128px',
} as const;

/**
 * Border radius system
 */
export const SDUIBorderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

/**
 * Shadow system
 */
export const SDUIShadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
  neon: `0 0 10px ${SDUIColors.neon}, 0 0 20px ${SDUIColors.neon}`,
} as const;

/**
 * Transition system
 */
export const SDUITransitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/**
 * Z-index system
 */
export const SDUIZIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

/**
 * Component-specific styles
 */
export const SDUIComponentStyles = {
  card: {
    background: SDUIColors.card,
    borderRadius: SDUIBorderRadius.md,
    border: `1px solid ${SDUIColors.border}`,
    padding: SDUISpacing.sm,
    transition: SDUITransitions.base,
    hover: {
      background: SDUIColors.cardHover,
      borderColor: SDUIColors.borderHover,
    },
  },
  button: {
    primary: {
      background: `linear-gradient(135deg, ${SDUIColors.neon}, ${SDUIColors.neonDark})`,
      color: SDUIColors.textInverse,
      borderRadius: SDUIBorderRadius.sm,
      padding: `${SDUISpacing.xs} ${SDUISpacing.sm}`,
      fontWeight: SDUITypography.fontWeight.semibold,
      transition: SDUITransitions.fast,
      hover: {
        boxShadow: SDUIShadows.neon,
        transform: 'translateY(-1px)',
      },
    },
    secondary: {
      background: 'transparent',
      color: SDUIColors.neon,
      border: `1px solid ${SDUIColors.neon}`,
      borderRadius: SDUIBorderRadius.sm,
      padding: `${SDUISpacing.xs} ${SDUISpacing.sm}`,
      fontWeight: SDUITypography.fontWeight.medium,
      transition: SDUITransitions.fast,
      hover: {
        background: `${SDUIColors.neon}20`,
      },
    },
    ghost: {
      background: 'transparent',
      color: SDUIColors.textPrimary,
      borderRadius: SDUIBorderRadius.sm,
      padding: `${SDUISpacing.xs} ${SDUISpacing.sm}`,
      transition: SDUITransitions.fast,
      hover: {
        background: SDUIColors.surface,
      },
    },
  },
  input: {
    background: SDUIColors.surface,
    border: `1px solid ${SDUIColors.border}`,
    borderRadius: SDUIBorderRadius.sm,
    padding: `${SDUISpacing.xs} ${SDUISpacing.sm}`,
    color: SDUIColors.textPrimary,
    fontSize: SDUITypography.fontSize.base,
    transition: SDUITransitions.fast,
    focus: {
      borderColor: SDUIColors.neon,
      boxShadow: `0 0 0 3px ${SDUIColors.neon}20`,
    },
  },
  badge: {
    background: `${SDUIColors.neon}20`,
    color: SDUIColors.neon,
    borderRadius: SDUIBorderRadius.full,
    padding: `4px ${SDUISpacing.xs}`,
    fontSize: SDUITypography.fontSize.xs,
    fontWeight: SDUITypography.fontWeight.semibold,
  },
} as const;

/**
 * Tailwind CSS class utilities
 */
export const SDUITailwindClasses = {
  card: 'bg-[#333333] rounded-lg border border-[#444444] p-4 transition-all duration-200 hover:bg-[#3A3A3A] hover:border-[#555555]',
  buttonPrimary: 'bg-gradient-to-br from-[#39FF14] to-[#0A3A0A] text-[#121212] rounded px-4 py-2 font-semibold transition-all duration-150 hover:shadow-[0_0_10px_#39FF14] hover:-translate-y-0.5',
  buttonSecondary: 'bg-transparent text-[#39FF14] border border-[#39FF14] rounded px-4 py-2 font-medium transition-all duration-150 hover:bg-[#39FF1420]',
  buttonGhost: 'bg-transparent text-white rounded px-4 py-2 transition-all duration-150 hover:bg-[#333333]',
  input: 'bg-[#333333] border border-[#444444] rounded px-4 py-2 text-white transition-all duration-150 focus:border-[#39FF14] focus:ring-2 focus:ring-[#39FF1420]',
  badge: 'bg-[#39FF1420] text-[#39FF14] rounded-full px-2 py-1 text-xs font-semibold',
  text: {
    primary: 'text-white',
    secondary: 'text-[#B3B3B3]',
    tertiary: 'text-[#808080]',
    neon: 'text-[#39FF14]',
  },
} as const;

/**
 * CSS-in-JS style object generator
 */
export function getSDUIStyles(component: keyof typeof SDUIComponentStyles): Record<string, any> {
  return SDUIComponentStyles[component];
}

/**
 * Generate inline styles for a component
 */
export function generateInlineStyles(
  component: keyof typeof SDUIComponentStyles,
  state?: 'hover' | 'focus' | 'active'
): React.CSSProperties {
  const baseStyles = SDUIComponentStyles[component];
  
  if (typeof baseStyles === 'object' && 'primary' in baseStyles) {
    // Handle button variants
    return baseStyles.primary as React.CSSProperties;
  }
  
  if (state && typeof baseStyles === 'object' && state in baseStyles) {
    return { ...baseStyles, ...(baseStyles as any)[state] } as React.CSSProperties;
  }
  
  return baseStyles as React.CSSProperties;
}

/**
 * Theme export for Tailwind config
 */
export const SDUITailwindTheme = {
  colors: SDUIColors,
  fontFamily: SDUITypography.fontFamily,
  fontSize: SDUITypography.fontSize,
  fontWeight: SDUITypography.fontWeight,
  spacing: SDUISpacing,
  borderRadius: SDUIBorderRadius,
  boxShadow: SDUIShadows,
  transitionDuration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
  },
  zIndex: SDUIZIndex,
};

export default {
  colors: SDUIColors,
  typography: SDUITypography,
  spacing: SDUISpacing,
  borderRadius: SDUIBorderRadius,
  shadows: SDUIShadows,
  transitions: SDUITransitions,
  zIndex: SDUIZIndex,
  componentStyles: SDUIComponentStyles,
  tailwindClasses: SDUITailwindClasses,
};
