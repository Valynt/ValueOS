/**
 * Material Theme Provider
 * 
 * Dynamic Material Design 3 theme provider with CSS variable injection.
 * Supports tenant branding color extraction and system preference sync.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeContextType {
  /** Current source color (hex) */
  sourceColor: string;
  /** Set source color manually */
  setSourceColor: (color: string) => void;
  /** Current color scheme preference */
  scheme: 'light' | 'dark' | 'system';
  /** Set color scheme */
  setScheme: (scheme: 'light' | 'dark' | 'system') => void;
  /** Whether dark mode is currently active */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export interface MaterialThemeProviderProps {
  children: ReactNode;
  /** Tenant brand color (hex) - optional override */
  tenantBrandColor?: string;
  /** Default color scheme */
  defaultScheme?: 'light' | 'dark' | 'system';
}

// Default Material 3 light theme values
const defaultLightColors = {
  // Primary
  '--md-sys-color-primary': '#000000',
  '--md-sys-color-on-primary': '#ffffff',
  '--md-sys-color-primary-container': '#131b2e',
  '--md-sys-color-on-primary-container': '#7c839b',
  '--md-sys-color-primary-fixed': '#dae2fd',
  '--md-sys-color-primary-fixed-dim': '#bec6e0',
  '--md-sys-color-on-primary-fixed': '#131b2e',
  '--md-sys-color-on-primary-fixed-variant': '#3f465c',
  '--md-sys-color-inverse-primary': '#bec6e0',
  // Secondary
  '--md-sys-color-secondary': '#515f74',
  '--md-sys-color-on-secondary': '#ffffff',
  '--md-sys-color-secondary-container': '#d5e3fc',
  '--md-sys-color-on-secondary-container': '#57657a',
  '--md-sys-color-secondary-fixed': '#d5e3fc',
  '--md-sys-color-secondary-fixed-dim': '#b9c7df',
  '--md-sys-color-on-secondary-fixed': '#0d1c2e',
  '--md-sys-color-on-secondary-fixed-variant': '#3a485b',
  // Tertiary (Purple accent)
  '--md-sys-color-tertiary': '#000000',
  '--md-sys-color-on-tertiary': '#ffffff',
  '--md-sys-color-tertiary-container': '#25005a',
  '--md-sys-color-on-tertiary-container': '#9863ff',
  '--md-sys-color-tertiary-fixed': '#eaddff',
  '--md-sys-color-tertiary-fixed-dim': '#d2bbff',
  '--md-sys-color-on-tertiary-fixed': '#25005a',
  '--md-sys-color-on-tertiary-fixed-variant': '#5a00c6',
  // Error
  '--md-sys-color-error': '#ba1a1a',
  '--md-sys-color-on-error': '#ffffff',
  '--md-sys-color-error-container': '#ffdad6',
  '--md-sys-color-on-error-container': '#93000a',
  // Surface
  '--md-sys-color-surface': '#f7f9fb',
  '--md-sys-color-surface-dim': '#d8dadc',
  '--md-sys-color-surface-bright': '#f7f9fb',
  '--md-sys-color-surface-container-lowest': '#ffffff',
  '--md-sys-color-surface-container-low': '#f2f4f6',
  '--md-sys-color-surface-container': '#eceef0',
  '--md-sys-color-surface-container-high': '#e6e8ea',
  '--md-sys-color-surface-container-highest': '#e0e3e5',
  '--md-sys-color-surface-variant': '#e0e3e5',
  '--md-sys-color-on-surface': '#191c1e',
  '--md-sys-color-on-surface-variant': '#45464d',
  '--md-sys-color-inverse-surface': '#2d3133',
  '--md-sys-color-inverse-on-surface': '#eff1f3',
  '--md-sys-color-surface-tint': '#565e74',
  // Outline
  '--md-sys-color-outline': '#76777d',
  '--md-sys-color-outline-variant': '#c6c6cd',
  // Background
  '--md-sys-color-background': '#f7f9fb',
  '--md-sys-color-on-background': '#191c1e',
};

// Default Material 3 dark theme values
const defaultDarkColors = {
  // Surface (inverted)
  '--md-sys-color-surface': '#191c1e',
  '--md-sys-color-surface-dim': '#141618',
  '--md-sys-color-surface-bright': '#363a3c',
  '--md-sys-color-surface-container-lowest': '#0d0e0f',
  '--md-sys-color-surface-container-low': '#1b1d1f',
  '--md-sys-color-surface-container': '#212325',
  '--md-sys-color-surface-container-high': '#2b2d2f',
  '--md-sys-color-surface-container-highest': '#36383a',
  '--md-sys-color-surface-variant': '#42474b',
  '--md-sys-color-on-surface': '#e0e3e5',
  '--md-sys-color-on-surface-variant': '#c3c7cc',
  '--md-sys-color-inverse-surface': '#e0e3e5',
  '--md-sys-color-inverse-on-surface': '#191c1e',
  // Primary (inverted containers)
  '--md-sys-color-on-primary': '#131b2e',
  '--md-sys-color-primary-container': '#dae2fd',
  '--md-sys-color-on-primary-container': '#131b2e',
  // Secondary (inverted containers)
  '--md-sys-color-on-secondary': '#0d1c2e',
  '--md-sys-color-secondary-container': '#515f74',
  '--md-sys-color-on-secondary-container': '#d5e3fc',
  // Tertiary (inverted containers)
  '--md-sys-color-on-tertiary': '#25005a',
  '--md-sys-color-tertiary-container': '#9863ff',
  '--md-sys-color-on-tertiary-container': '#25005a',
  // Outline
  '--md-sys-color-outline': '#919499',
  '--md-sys-color-outline-variant': '#42474b',
  // Background
  '--md-sys-color-background': '#191c1e',
  '--md-sys-color-on-background': '#e0e3e5',
};

export function MaterialThemeProvider({ 
  children,
  tenantBrandColor,
  defaultScheme = 'system',
}: MaterialThemeProviderProps) {
  const [sourceColor, setSourceColor] = useState(tenantBrandColor || '#000000');
  const [scheme, setScheme] = useState<'light' | 'dark' | 'system'>(defaultScheme);
  const [isDark, setIsDark] = useState(false);

  // Apply theme colors to CSS variables
  useEffect(() => {
    // Determine if dark mode is active
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeDark = scheme === 'system' ? systemDark : scheme === 'dark';
    setIsDark(activeDark);

    // Apply base colors
    const baseColors = activeDark ? 
      { ...defaultLightColors, ...defaultDarkColors } : 
      defaultLightColors;
    
    Object.entries(baseColors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    // Apply data-theme attribute for selector-based dark mode
    if (activeDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [scheme, sourceColor]);

  // Listen for system color scheme changes
  useEffect(() => {
    if (scheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const systemDark = mediaQuery.matches;
      setIsDark(systemDark);
      
      const baseColors = systemDark ? 
        { ...defaultLightColors, ...defaultDarkColors } : 
        defaultLightColors;
      
      Object.entries(baseColors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });

      if (systemDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [scheme, sourceColor]);

  // Update source color when tenant brand color changes
  useEffect(() => {
    if (tenantBrandColor) {
      setSourceColor(tenantBrandColor);
    }
  }, [tenantBrandColor]);

  return (
    <ThemeContext.Provider value={{ sourceColor, setSourceColor, scheme, setScheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useMaterialTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useMaterialTheme must be used within MaterialThemeProvider');
  }
  return context;
}
