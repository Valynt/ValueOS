import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { 
    ignores: [
      'dist',
      'build',
      '*.min.js',
      'node_modules',
      'vendor',
      'coverage',
      '.cache',
      '*.config.js',
      '!eslint.config.js',
      '**/__fixtures__',
      '**/__mocks__',
      'src/mcp-ground-truth/examples',
      '.storybook',
      'storybook-static',
      'scripts/**/*',  // Scripts can use console.log
      'blueprint/**/*', // Blueprint examples
      'docs/**/*',      // Documentation code
    ] 
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn', // Downgrade to warning for migration
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      // Enforce proper logging - only allow console.warn and console.error
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'],
        },
      ],
    },
  }
);
