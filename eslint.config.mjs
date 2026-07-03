import eslint from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**']
  },
  eslint.configs.recommended,
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: 'readonly',
        CodexUsage: 'readonly',
        FormatUtils: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['warn', 'always', { null: 'ignore' }]
    }
  },
  {
    files: ['tests/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        CodexUsage: 'readonly',
        FormatUtils: 'readonly'
      }
    }
  },
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node
    }
  }
];
