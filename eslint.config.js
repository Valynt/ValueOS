import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
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
      'backup/**/*',    // Backup files
      'prisma/**/*',    // Prisma generated files and seeds
      'services/**/*',  // External services
      'migrations/**/*', // Database migrations
      'supabase/**/*',  // Supabase files
      'test-results/**/*', // Test results
      'playwright-report/**/*', // Playwright reports
      'reports/**/*',   // Generated reports
      'grafana/**/*',   // Grafana configs
      'infrastructure/**/*', // Infrastructure files
      'k8s/**/*',       // Kubernetes files
      'kubernetes/**/*', // Kubernetes files
      'alembic/**/*',   // Alembic migrations
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
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/control-has-associated-label': [
        'error',
        {
          labelAttributes: ['aria-label', 'aria-labelledby', 'htmlFor'],
          controlComponents: ['Input', 'Select'],
        },
      ],
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/tabindex-no-positive': 'error',
      // Temporarily relaxed rules for production launch - re-enable in Week 3
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
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
