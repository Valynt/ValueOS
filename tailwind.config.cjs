/**
 * Tailwind Configuration for VALYNT Design System
 * 
 * This config extends Tailwind with VALYNT brand tokens and shadcn/ui integration.
 * All colors reference CSS variables defined in src/index.css.
 * 
 * VALYNT Design Principles:
 * - Dark-first approach (dark mode is default)
 * - Semantic token usage (never raw hex values)
 * - 8px spacing grid (vc-1, vc-2, vc-3, etc.)
 * - Value Teal for value intelligence
 * - Graph Grey for structure/metadata
 */

module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		colors: {
  			/* shadcn/ui semantic tokens (mapped to VALYNT in CSS) */
  			background: 'hsl(var(--background))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			foreground: 'hsl(var(--foreground))',
  			'card-foreground': 'hsl(var(--card-foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-foreground': 'hsl(var(--primary-foreground))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			'muted-foreground': 'hsl(var(--muted-foreground))',
  			border: 'hsl(var(--border))',
  			ring: 'hsl(var(--ring))',
  			success: 'hsl(var(--status-success))',
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			warning: 'hsl(var(--status-warning))',
  			info: 'hsl(var(--status-info))',
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			/* VALYNT brand colors (direct access to design tokens) */
  			'vc-surface': {
  				'1': 'hsl(var(--vc-surface-1))',
  				'2': 'hsl(var(--vc-surface-2))',
  				'3': 'hsl(var(--vc-surface-3))'
  			},
  			'vc-teal': {
  				'400': 'hsl(var(--vc-accent-teal-400))',
  				'500': 'hsl(var(--vc-accent-teal-500))'
  			},
  			'vc-grey': {
  				'500': 'hsl(var(--vc-accent-grey-500))'
  			},
  			'vc-border': {
  				'default': 'hsl(var(--vc-border-default))',
  				'strong': 'hsl(var(--vc-border-strong))'
  			}
  		},
  		spacing: {
  			'vc-1': '0.5rem',
  			'vc-2': '1rem',
  			'vc-3': '1.5rem',
  			'vc-4': '2rem',
  			'vc-6': '3rem',
  			'vc-8': '4rem'
  		},
  		borderRadius: {
  			'vc-md': '0.5rem',
  			'vc-xl': '1rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'-apple-system',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'sans-serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Roboto Mono',
  				'Courier New',
  				'monospace'
  			]
  		},
  		fontSize: {
  			xs: '0.75rem',
  			sm: '0.875rem',
  			base: '1rem',
  			'3xl': '1.875rem',
  			'5xl': '3rem',
  			'6xl': '3.75rem'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
