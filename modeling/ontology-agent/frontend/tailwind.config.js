/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'agent-purple': '#667eea',
        'agent-pink': '#764ba2',
        'agent-green': '#38ef7d',
        'agent-teal': '#11998e',
        'agent-coral': '#fc466b',
        'agent-blue': '#4facfe',
        'agent-orange': '#ff9a44',
        'dark': {
          900: '#0f0f23',
          800: '#1a1a3e',
          700: '#252550',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(102, 126, 234, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(102, 126, 234, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
