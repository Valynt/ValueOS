import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

/**
 * Storybook Preview Configuration for VALYNT Design System
 * 
 * This configuration applies VALYNT theming to all stories:
 * - Dark-first approach (dark mode is default)
 * - VALYNT color tokens and typography
 * - shadcn/ui component integration
 */

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'valynt-dark',
      values: [
        {
          name: 'valynt-dark',
          value: 'hsl(230, 10%, 4%)', // --vc-surface-1
        },
        {
          name: 'valynt-surface-2',
          value: 'hsl(230, 12%, 9%)', // --vc-surface-2
        },
        {
          name: 'valynt-surface-3',
          value: 'hsl(230, 12%, 12%)', // --vc-surface-3
        },
      ],
    },
    // Apply dark mode by default
    layout: 'centered',
  },
  globalTypes: {
    theme: {
      description: 'VALYNT theme mode',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['dark', 'light'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;