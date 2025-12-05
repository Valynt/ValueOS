/** @type {import('tailwindcss').Config} */
import sduiTheme from './src/sdui/theme/tailwind.sdui.config.js';

const sduiExtend = sduiTheme.theme?.extend ?? {};

const config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      ...sduiExtend,
      fontFamily: {
        ...(sduiExtend.fontFamily ?? {}),
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        ...(sduiExtend.colors ?? {}),
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          background: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        ...(sduiExtend.borderRadius ?? {}),
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        ...(sduiExtend.boxShadow ?? {}),
        'beautiful-sm':
          '0px 2px 3px -1px rgba(0,0,0,0.1),0px 1px 0px 0px rgba(25,28,33,0.02),0px 0px 0px 1px rgba(25,28,33,0.08)',
        'beautiful-md':
          '0px 0px 0px 1px rgba(0,0,0,0.06),0px 1px 1px -0.5px rgba(0,0,0,0.06),0px 3px 3px -1.5px rgba(0,0,0,0.06),0px 6px 6px -3px rgba(0,0,0,0.06),0px 12px 12px -6px rgba(0,0,0,0.06),0px 24px 24px -12px rgba(0,0,0,0.06)',
        'beautiful-lg':
          '0 2.8px 2.2px rgba(0,0,0,0.034),0 6.7px 5.3px rgba(0,0,0,0.048),0 12.5px 10px rgba(0,0,0,0.06),0 22.3px 17.9px rgba(0,0,0,0.072),0 41.8px 33.4px rgba(0,0,0,0.086),0 100px 80px rgba(0,0,0,0.12)',
        'light-blue-sm':
          '0px 0px 0px 1px rgba(14,63,126,0.04),0px 1px 1px -0.5px rgba(42,51,69,0.04),0px 3px 3px -1.5px rgba(42,51,70,0.04),0px 6px 6px -3px rgba(42,51,70,0.04),0px 12px 12px -6px rgba(14,63,126,0.04),0px 24px 24px -12px rgba(14,63,126,0.04)',
      },
    },
  },
  plugins: [...(sduiTheme.plugins ?? [])],
};

export default config;
