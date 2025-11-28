/**
 * Tailwind CSS Configuration for SDUI Dark Theme
 * 
 * Import this configuration into your main tailwind.config.js:
 * 
 * ```javascript
 * const sduiTheme = require('./src/sdui/theme/tailwind.sdui.config');
 * 
 * module.exports = {
 *   ...sduiTheme,
 *   // Your other config
 * }
 * ```
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        // SDUI primary colors
        'sdui-dark': '#121212',
        'sdui-neon': '#39FF14',
        'sdui-neon-dark': '#0A3A0A',
        
        // SDUI surface colors
        'sdui-card': '#333333',
        'sdui-card-hover': '#3A3A3A',
        'sdui-border': '#444444',
        'sdui-border-hover': '#555555',
        
        // SDUI text colors
        'sdui-text-primary': '#FFFFFF',
        'sdui-text-secondary': '#B3B3B3',
        'sdui-text-tertiary': '#808080',
        'sdui-text-inverse': '#121212',
        
        // SDUI status colors
        'sdui-success': '#39FF14',
        'sdui-warning': '#FFB800',
        'sdui-error': '#FF3B30',
        'sdui-info': '#0A84FF',
        
        // SDUI semantic colors
        'sdui-background': '#121212',
        'sdui-background-elevated': '#1A1A1A',
        'sdui-surface': '#333333',
        'sdui-surface-hover': '#3A3A3A',
      },
      
      fontFamily: {
        'sdui': ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        'sdui-mono': ['"SF Mono"', 'Monaco', '"Cascadia Code"', '"Roboto Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      
      fontSize: {
        'sdui-xs': '0.75rem',    // 12px
        'sdui-sm': '0.875rem',   // 14px
        'sdui-base': '1rem',     // 16px
        'sdui-lg': '1.125rem',   // 18px
        'sdui-xl': '1.25rem',    // 20px
        'sdui-2xl': '1.5rem',    // 24px
        'sdui-3xl': '1.875rem',  // 30px
        'sdui-4xl': '2.25rem',   // 36px
      },
      
      spacing: {
        'sdui-xs': '8px',
        'sdui-sm': '16px',
        'sdui-md': '24px',
        'sdui-lg': '32px',
        'sdui-xl': '48px',
        'sdui-2xl': '64px',
        'sdui-3xl': '96px',
        'sdui-4xl': '128px',
      },
      
      borderRadius: {
        'sdui-sm': '4px',
        'sdui-md': '8px',
        'sdui-lg': '12px',
        'sdui-xl': '16px',
      },
      
      boxShadow: {
        'sdui-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
        'sdui-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'sdui-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'sdui-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        'sdui-neon': '0 0 10px #39FF14, 0 0 20px #39FF14',
      },
      
      transitionDuration: {
        'sdui-fast': '150ms',
        'sdui-base': '200ms',
        'sdui-slow': '300ms',
      },
      
      zIndex: {
        'sdui-dropdown': '1000',
        'sdui-sticky': '1100',
        'sdui-fixed': '1200',
        'sdui-modal-backdrop': '1300',
        'sdui-modal': '1400',
        'sdui-popover': '1500',
        'sdui-tooltip': '1600',
      },
      
      backgroundImage: {
        'sdui-gradient-primary': 'linear-gradient(135deg, #39FF14, #0A3A0A)',
        'sdui-gradient-dark': 'linear-gradient(180deg, #121212, #1A1A1A)',
      },
    },
  },
  
  plugins: [
    // Custom SDUI component classes
    function({ addComponents }) {
      addComponents({
        '.sdui-card': {
          backgroundColor: '#333333',
          borderRadius: '8px',
          border: '1px solid #444444',
          padding: '16px',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: '#3A3A3A',
            borderColor: '#555555',
          },
        },
        '.sdui-btn-primary': {
          background: 'linear-gradient(135deg, #39FF14, #0A3A0A)',
          color: '#121212',
          borderRadius: '4px',
          padding: '8px 16px',
          fontWeight: '600',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 0 10px #39FF14, 0 0 20px #39FF14',
            transform: 'translateY(-1px)',
          },
        },
        '.sdui-btn-secondary': {
          backgroundColor: 'transparent',
          color: '#39FF14',
          border: '1px solid #39FF14',
          borderRadius: '4px',
          padding: '8px 16px',
          fontWeight: '500',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgba(57, 255, 20, 0.1)',
          },
        },
        '.sdui-btn-ghost': {
          backgroundColor: 'transparent',
          color: '#FFFFFF',
          borderRadius: '4px',
          padding: '8px 16px',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: '#333333',
          },
        },
        '.sdui-input': {
          backgroundColor: '#333333',
          border: '1px solid #444444',
          borderRadius: '4px',
          padding: '8px 16px',
          color: '#FFFFFF',
          fontSize: '1rem',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:focus': {
            borderColor: '#39FF14',
            boxShadow: '0 0 0 3px rgba(57, 255, 20, 0.2)',
            outline: 'none',
          },
        },
        '.sdui-badge': {
          backgroundColor: 'rgba(57, 255, 20, 0.2)',
          color: '#39FF14',
          borderRadius: '9999px',
          padding: '4px 8px',
          fontSize: '0.75rem',
          fontWeight: '600',
        },
      });
    },
  ],
};
