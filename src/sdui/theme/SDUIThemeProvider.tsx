/**
 * SDUI Theme Provider
 * 
 * Provides theme context to all SDUI components.
 * Supports tenant-specific theme overrides.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { ThemeConfig } from '../TenantContext';
import { SDUIColors, SDUITypography, SDUISpacing } from './SDUITheme';

/**
 * Theme context value
 */
interface SDUIThemeContextValue {
  theme: ThemeConfig;
  colors: typeof SDUIColors;
  typography: typeof SDUITypography;
  spacing: typeof SDUISpacing;
  setTheme: (theme: Partial<ThemeConfig>) => void;
}

/**
 * Theme context
 */
const SDUIThemeContext = createContext<SDUIThemeContextValue | undefined>(undefined);

/**
 * Theme provider props
 */
interface SDUIThemeProviderProps {
  children: React.ReactNode;
  theme?: Partial<ThemeConfig>;
  onThemeChange?: (theme: ThemeConfig) => void;
}

/**
 * Default theme configuration
 */
const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  primaryColor: SDUIColors.dark,
  accentColor: SDUIColors.neon,
  fontFamily: SDUITypography.fontFamily.base,
};

/**
 * SDUI Theme Provider Component
 */
export const SDUIThemeProvider: React.FC<SDUIThemeProviderProps> = ({
  children,
  theme: initialTheme,
  onThemeChange,
}) => {
  const [theme, setThemeState] = React.useState<ThemeConfig>({
    ...DEFAULT_THEME,
    ...initialTheme,
  });

  const setTheme = React.useCallback(
    (newTheme: Partial<ThemeConfig>) => {
      const updatedTheme = { ...theme, ...newTheme };
      setThemeState(updatedTheme);
      onThemeChange?.(updatedTheme);
    },
    [theme, onThemeChange]
  );

  const contextValue = useMemo(
    () => ({
      theme,
      colors: SDUIColors,
      typography: SDUITypography,
      spacing: SDUISpacing,
      setTheme,
    }),
    [theme, setTheme]
  );

  // Apply theme to document root
  React.useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS variables
    root.style.setProperty('--sdui-primary-color', theme.primaryColor || SDUIColors.dark);
    root.style.setProperty('--sdui-accent-color', theme.accentColor || SDUIColors.neon);
    root.style.setProperty('--sdui-font-family', theme.fontFamily || SDUITypography.fontFamily.base);
    
    // Set theme mode class
    root.classList.remove('sdui-light', 'sdui-dark');
    root.classList.add(`sdui-${theme.mode}`);
    
    // Apply custom styles
    if (theme.customStyles) {
      Object.entries(theme.customStyles).forEach(([key, value]) => {
        root.style.setProperty(`--sdui-${key}`, String(value));
      });
    }
  }, [theme]);

  return (
    <SDUIThemeContext.Provider value={contextValue}>
      {children}
    </SDUIThemeContext.Provider>
  );
};

/**
 * Hook to access SDUI theme
 */
export function useSDUITheme(): SDUIThemeContextValue {
  const context = useContext(SDUIThemeContext);
  
  if (!context) {
    throw new Error('useSDUITheme must be used within SDUIThemeProvider');
  }
  
  return context;
}

/**
 * Hook to access theme colors
 */
export function useSDUIColors() {
  const { colors } = useSDUITheme();
  return colors;
}

/**
 * Hook to access theme typography
 */
export function useSDUITypography() {
  const { typography } = useSDUITheme();
  return typography;
}

/**
 * Hook to access theme spacing
 */
export function useSDUISpacing() {
  const { spacing } = useSDUITheme();
  return spacing;
}

/**
 * HOC to inject theme props
 */
export function withSDUITheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeConfig }>
): React.FC<P> {
  return (props: P) => {
    const { theme } = useSDUITheme();
    return <Component {...props} theme={theme} />;
  };
}

export default SDUIThemeProvider;
